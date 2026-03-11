package com.example.finance.util;

import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

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

    private static final Set<String> TIME_HEADERS = Set.of(
            "time", "date", "datetime", "transactiontime", "tradetime",
            "发生时间", "交易时间", "时间", "日期"
    );
    private static final Set<String> AMOUNT_HEADERS = Set.of(
            "amount", "money", "transactionamount", "金额", "金额元", "收支金额"
    );
    private static final Set<String> TYPE_HEADERS = Set.of(
            "type", "transactiontype", "inout", "incomeexpense", "收支类型", "类型", "收支", "收/支"
    );
    private static final Set<String> MERCHANT_HEADERS = Set.of(
            "merchant", "merchantname", "counterparty", "tradingparty",
            "商户", "商户名称", "交易对方", "对方", "收付款方"
    );
    private static final Set<String> NOTE_HEADERS = Set.of(
            "note", "remark", "description", "memo", "备注", "说明", "商品说明"
    );
    private static final Set<String> CATEGORY_HEADERS = Set.of(
            "category", "分类", "消费分类"
    );

    private CsvParserUtil() {
    }

    public static ParseResult parse(MultipartFile file) throws IOException {
        List<ParsedRow> rows = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8)
        )) {
            String firstLine = reader.readLine();
            if (firstLine == null) {
                errors.add("CSV 文件为空");
                return new ParseResult(rows, errors);
            }

            firstLine = stripBom(firstLine);
            List<String> firstColumns = splitCsvLine(firstLine);
            HeaderMapping headerMapping = HeaderMapping.from(firstColumns);

            int lineNumber = 1;
            if (!headerMapping.hasHeader()) {
                parseDataLine(firstColumns, headerMapping, lineNumber, rows, errors);
            }

            String line;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (line.isBlank()) {
                    continue;
                }
                parseDataLine(splitCsvLine(line), headerMapping, lineNumber, rows, errors);
            }
        }

        return new ParseResult(rows, errors);
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
            case "TRANSFER", "转账" -> "TRANSFER";
            default -> amount.signum() < 0 ? "EXPENSE" : "INCOME";
        };
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
            String rawLine
    ) {
    }

    public record ParseResult(List<ParsedRow> rows, List<String> errors) {
    }

    private record HeaderMapping(
            boolean hasHeader,
            Integer timeIndex,
            Integer amountIndex,
            Integer typeIndex,
            Integer merchantIndex,
            Integer noteIndex,
            Integer categoryIndex
    ) {

        private static HeaderMapping from(List<String> headers) {
            Map<String, Integer> headerIndexMap = HeaderIndex.build(headers);
            Integer timeIndex = HeaderIndex.find(headerIndexMap, TIME_HEADERS);
            Integer amountIndex = HeaderIndex.find(headerIndexMap, AMOUNT_HEADERS);
            Integer typeIndex = HeaderIndex.find(headerIndexMap, TYPE_HEADERS);
            Integer merchantIndex = HeaderIndex.find(headerIndexMap, MERCHANT_HEADERS);
            Integer noteIndex = HeaderIndex.find(headerIndexMap, NOTE_HEADERS);
            Integer categoryIndex = HeaderIndex.find(headerIndexMap, CATEGORY_HEADERS);
            boolean hasHeader = timeIndex != null || amountIndex != null || merchantIndex != null || typeIndex != null;
            return new HeaderMapping(hasHeader, timeIndex, amountIndex, typeIndex, merchantIndex, noteIndex, categoryIndex);
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

        private static Integer find(Map<String, Integer> headerIndexMap, Set<String> aliases) {
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
