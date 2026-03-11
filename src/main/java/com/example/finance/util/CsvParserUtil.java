package com.example.finance.util;

import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class CsvParserUtil {

    private static final List<DateTimeFormatter> DATE_TIME_FORMATTERS = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy-M-d H:m:s"),
            DateTimeFormatter.ofPattern("yyyy-M-d H:m"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"),
            DateTimeFormatter.ISO_LOCAL_DATE_TIME
    );

    private static final List<String> TIME_HEADERS = List.of(
            "time", "date", "datetime", "transactiontime", "tradetime",
            "发生时间", "交易时间", "交易创建时间", "付款时间", "时间", "日期"
    );
    private static final List<String> AMOUNT_HEADERS = List.of(
            "amount", "money", "transactionamount", "金额", "金额元", "收支金额", "订单金额"
    );
    private static final List<String> TYPE_HEADERS = List.of(
            "收/支", "收支", "inout", "incomeexpense", "收支类型", "type", "transactiontype", "类型", "交易类型"
    );
    private static final List<String> MERCHANT_HEADERS = List.of(
            "merchant", "merchantname", "counterparty", "tradingparty",
            "商户", "商户名称", "交易对方", "对方", "收付款方", "对方户名"
    );
    private static final List<String> NOTE_HEADERS = List.of(
            "note", "remark", "description", "memo", "备注", "说明", "商品说明", "商品", "商品名称"
    );
    private static final List<String> CATEGORY_HEADERS = List.of(
            "category", "分类", "消费分类", "一级分类"
    );
    private static final List<String> TRADE_NO_HEADERS = List.of(
            "tradeno", "transactionno", "orderNo", "orderno", "externaltradeno",
            "交易单号", "流水号", "交易流水号", "商户单号", "订单号", "交易号", "商家订单号", "微信支付订单号"
    );

    private CsvParserUtil() {
    }

    public static ParseResult parse(MultipartFile file) throws IOException {
        return parse(file, null);
    }

    public static ParseResult parse(MultipartFile file, String sourcePlatform) throws IOException {
        byte[] fileBytes = file.getBytes();
        List<ParseCandidate> candidates = new ArrayList<>();
        candidates.add(parse(fileBytes, StandardCharsets.UTF_8));

        // Chinese wallet export files are often encoded in GBK, especially on Windows.
        if (shouldTryGbk(sourcePlatform)) {
            candidates.add(parse(fileBytes, Charset.forName("GBK")));
        }

        return chooseBestCandidate(candidates).result();
    }

    private static ParseCandidate parse(byte[] fileBytes, Charset charset) throws IOException {
        List<ParsedRow> rows = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        boolean hasHeader = false;

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(new ByteArrayInputStream(fileBytes), charset)
        )) {
            String firstLine = reader.readLine();
            if (firstLine == null) {
                errors.add("CSV 文件为空");
                return new ParseCandidate(new ParseResult(rows, errors), false, charset);
            }

            firstLine = stripBom(firstLine);
            List<String> firstColumns = splitCsvLine(firstLine);
            HeaderMapping headerMapping = HeaderMapping.from(firstColumns);
            hasHeader = headerMapping.hasHeader();

            int lineNumber = 1;
            if (!headerMapping.hasHeader()) {
                if (!shouldIgnoreLine(firstLine)) {
                    parseDataLine(firstColumns, headerMapping, lineNumber, rows, errors);
                }
            }

            String line;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (line.isBlank()) {
                    continue;
                }
                if (shouldIgnoreLine(line)) {
                    continue;
                }
                parseDataLine(splitCsvLine(line), headerMapping, lineNumber, rows, errors);
            }
        }

        return new ParseCandidate(new ParseResult(rows, errors), hasHeader, charset);
    }

    private static void parseDataLine(
            List<String> columns,
            HeaderMapping headerMapping,
            int lineNumber,
            List<ParsedRow> rows,
            List<String> errors
    ) {
        try {
            String timeText = headerMapping.value(columns, headerMapping.timeIndex(), 0);
            String amountText = headerMapping.value(columns, headerMapping.amountIndex(), 1);
            String typeText = headerMapping.value(columns, headerMapping.typeIndex(), 2);
            String merchantText = headerMapping.value(columns, headerMapping.merchantIndex(), 3);
            String noteText = headerMapping.value(columns, headerMapping.noteIndex(), 4);
            String categoryText = headerMapping.value(columns, headerMapping.categoryIndex(), 5);
            String tradeNoText = headerMapping.value(columns, headerMapping.tradeNoIndex(), 6);

            LocalDateTime transactionTime = parseDateTime(timeText);
            BigDecimal rawAmount = parseAmount(amountText);
            String transactionType = normalizeTransactionType(typeText, rawAmount);
            BigDecimal amount = rawAmount.abs();
            if (amount.compareTo(BigDecimal.ZERO) == 0) {
                throw new IllegalArgumentException("金额不能为 0");
            }

            rows.add(new ParsedRow(
                    transactionTime,
                    amount,
                    transactionType,
                    trimToNull(merchantText),
                    trimToNull(noteText),
                    trimToNull(categoryText),
                    trimToNull(tradeNoText),
                    String.join(" | ", columns)
            ));
        } catch (RuntimeException exception) {
            errors.add("第 " + lineNumber + " 行解析失败: " + exception.getMessage());
        }
    }

    private static LocalDateTime parseDateTime(String text) {
        String normalized = trimToNull(text);
        if (normalized == null) {
            throw new IllegalArgumentException("缺少交易时间");
        }
        for (DateTimeFormatter formatter : DATE_TIME_FORMATTERS) {
            try {
                return LocalDateTime.parse(normalized, formatter);
            } catch (DateTimeParseException ignored) {
            }
        }
        throw new IllegalArgumentException("无法识别交易时间: " + normalized);
    }

    private static BigDecimal parseAmount(String text) {
        String normalized = trimToNull(text);
        if (normalized == null) {
            throw new IllegalArgumentException("缺少金额");
        }
        normalized = normalized
                .replace("¥", "")
                .replace("￥", "")
                .replace(",", "")
                .replace("元", "")
                .replace("RMB", "")
                .replace("CNY", "")
                .trim();
        return new BigDecimal(normalized);
    }

    private static String normalizeTransactionType(String text, BigDecimal amount) {
        String normalized = trimToNull(text);
        if (normalized == null) {
            return amount.signum() < 0 ? "EXPENSE" : "INCOME";
        }
        String upper = normalized.toUpperCase(Locale.ROOT);
        return switch (upper) {
            case "EXPENSE", "OUT", "PAY", "支出" -> "EXPENSE";
            case "INCOME", "IN", "RECEIVE", "收入" -> "INCOME";
            case "TRANSFER", "转账", "不计收支" -> "TRANSFER";
            default -> amount.signum() < 0 ? "EXPENSE" : "INCOME";
        };
    }

    private static boolean shouldIgnoreLine(String line) {
        String normalized = trimToNull(line);
        if (normalized == null) {
            return true;
        }
        String compact = normalized.replace(",", "").replace("|", "").replace("-", "").trim();
        return compact.startsWith("共")
                || compact.startsWith("本次")
                || compact.startsWith("统计")
                || compact.startsWith("导出说明");
    }

    private static boolean shouldTryGbk(String sourcePlatform) {
        if (sourcePlatform == null) {
            return true;
        }
        String normalized = sourcePlatform.trim().toUpperCase(Locale.ROOT);
        return normalized.isEmpty()
                || "CSV".equals(normalized)
                || "ALIPAY".equals(normalized)
                || "WECHAT".equals(normalized)
                || "WECHAT_PAY".equals(normalized);
    }

    private static ParseCandidate chooseBestCandidate(List<ParseCandidate> candidates) {
        ParseCandidate best = candidates.get(0);
        for (int i = 1; i < candidates.size(); i++) {
            ParseCandidate current = candidates.get(i);
            if (isBetter(current, best)) {
                best = current;
            }
        }
        return best;
    }

    private static boolean isBetter(ParseCandidate candidate, ParseCandidate best) {
        if (candidate.hasHeader() != best.hasHeader()) {
            return candidate.hasHeader();
        }
        if (candidate.result().rows().size() != best.result().rows().size()) {
            return candidate.result().rows().size() > best.result().rows().size();
        }
        if (candidate.result().errors().size() != best.result().errors().size()) {
            return candidate.result().errors().size() < best.result().errors().size();
        }
        return StandardCharsets.UTF_8.equals(best.charset()) && !StandardCharsets.UTF_8.equals(candidate.charset());
    }

    private static List<String> splitCsvLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;

        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    current.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }
            if (ch == ',' && !inQuotes) {
                values.add(current.toString().trim());
                current.setLength(0);
                continue;
            }
            current.append(ch);
        }
        values.add(current.toString().trim());
        return values;
    }

    private static String stripBom(String value) {
        return value != null && !value.isEmpty() && value.charAt(0) == '\uFEFF'
                ? value.substring(1)
                : value;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record ParsedRow(
            LocalDateTime transactionTime,
            BigDecimal amount,
            String transactionType,
            String merchantName,
            String note,
            String categoryName,
            String externalTradeNo,
            String rawLine
    ) {
    }

    public record ParseResult(List<ParsedRow> rows, List<String> errors) {
    }

    private record ParseCandidate(ParseResult result, boolean hasHeader, Charset charset) {
    }

    private record HeaderMapping(
            boolean hasHeader,
            Integer timeIndex,
            Integer amountIndex,
            Integer typeIndex,
            Integer merchantIndex,
            Integer noteIndex,
            Integer categoryIndex,
            Integer tradeNoIndex
    ) {

        private static HeaderMapping from(List<String> headers) {
            Map<String, Integer> headerIndexMap = HeaderIndex.build(headers);
            Integer timeIndex = HeaderIndex.find(headerIndexMap, TIME_HEADERS);
            Integer amountIndex = HeaderIndex.find(headerIndexMap, AMOUNT_HEADERS);
            Integer typeIndex = HeaderIndex.find(headerIndexMap, TYPE_HEADERS);
            Integer merchantIndex = HeaderIndex.find(headerIndexMap, MERCHANT_HEADERS);
            Integer noteIndex = HeaderIndex.find(headerIndexMap, NOTE_HEADERS);
            Integer categoryIndex = HeaderIndex.find(headerIndexMap, CATEGORY_HEADERS);
            Integer tradeNoIndex = HeaderIndex.find(headerIndexMap, TRADE_NO_HEADERS);
            boolean hasHeader = timeIndex != null || amountIndex != null || merchantIndex != null || typeIndex != null;
            return new HeaderMapping(
                    hasHeader,
                    timeIndex,
                    amountIndex,
                    typeIndex,
                    merchantIndex,
                    noteIndex,
                    categoryIndex,
                    tradeNoIndex
            );
        }

        private String value(List<String> columns, Integer mappedIndex, int fallbackIndex) {
            int index = mappedIndex == null ? fallbackIndex : mappedIndex;
            return index < columns.size() ? columns.get(index) : null;
        }
    }

    private static final class HeaderIndex {

        private HeaderIndex() {
        }

        private static Map<String, Integer> build(List<String> headers) {
            java.util.LinkedHashMap<String, Integer> result = new java.util.LinkedHashMap<>();
            for (int i = 0; i < headers.size(); i++) {
                result.put(normalize(headers.get(i)), i);
            }
            return result;
        }

        private static Integer find(Map<String, Integer> headerIndexMap, Collection<String> aliases) {
            for (String alias : aliases) {
                Integer index = headerIndexMap.get(normalize(alias));
                if (index != null) {
                    return index;
                }
            }
            return null;
        }

        private static String normalize(String value) {
            return stripBom(value == null ? "" : value)
                    .replace("（", "")
                    .replace("）", "")
                    .replace("(", "")
                    .replace(")", "")
                    .replace("_", "")
                    .replace("-", "")
                    .replace(" ", "")
                    .trim()
                    .toLowerCase(Locale.ROOT);
        }
    }
}
