package com.example.finance.util;

import org.springframework.util.StringUtils;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class RuleThresholdConfigUtil {

    private RuleThresholdConfigUtil() {
    }

    public static String normalizeThresholdJson(String ruleType, String thresholdJson) {
        if ("CONSECUTIVE_THRESHOLD".equals(ruleType)) {
            int consecutiveMonths = parseConsecutiveMonths(thresholdJson);
            Map<String, Object> normalized = new LinkedHashMap<>();
            normalized.put("consecutiveMonths", consecutiveMonths);
            return toJson(normalized);
        }
        if ("TREND_ANOMALY".equals(ruleType)) {
            int baselineMonths = parseBaselineMonths(thresholdJson);
            Map<String, Object> normalized = new LinkedHashMap<>();
            normalized.put("baselineMonths", baselineMonths);
            return toJson(normalized);
        }
        if (StringUtils.hasText(thresholdJson)) {
            throw new IllegalArgumentException("THRESHOLD 规则不需要 thresholdJson");
        }
        return null;
    }

    public static int parseConsecutiveMonths(String thresholdJson) {
        int consecutiveMonths = parsePositiveIntField(thresholdJson, "consecutiveMonths", 2);
        return consecutiveMonths;
    }

    public static int parseBaselineMonths(String thresholdJson) {
        int baselineMonths = parsePositiveIntField(thresholdJson, "baselineMonths", 2);
        return baselineMonths;
    }

    private static int parsePositiveIntField(String thresholdJson, String fieldName, int minimumValue) {
        if (!StringUtils.hasText(thresholdJson)) {
            throw new IllegalArgumentException("规则必须提供 thresholdJson");
        }
        Matcher matcher = integerFieldPattern(fieldName).matcher(thresholdJson);
        if (!matcher.find()) {
            throw new IllegalArgumentException("thresholdJson 必须包含 " + fieldName);
        }

        String rawValue = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
        int value;
        try {
            value = Integer.parseInt(rawValue);
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException(fieldName + " 必须是整数");
        }

        if (value < minimumValue) {
            throw new IllegalArgumentException(fieldName + " 必须大于等于 " + minimumValue);
        }
        return value;
    }

    private static Pattern integerFieldPattern(String fieldName) {
        String regex = "\"" + Pattern.quote(fieldName) + "\"\\s*:\\s*(?:\"(\\d+)\"|(\\d+))";
        return Pattern.compile(regex);
    }

    public static String toJson(Map<String, ?> value) {
        StringBuilder builder = new StringBuilder();
        appendJsonValue(builder, value);
        return builder.toString();
    }

    private static void appendJsonValue(StringBuilder builder, Object value) {
        if (value == null) {
            builder.append("null");
            return;
        }
        if (value instanceof String text) {
            builder.append('"').append(escapeJson(text)).append('"');
            return;
        }
        if (value instanceof Number || value instanceof Boolean) {
            builder.append(value);
            return;
        }
        if (value instanceof Map<?, ?> map) {
            builder.append('{');
            Iterator<? extends Map.Entry<?, ?>> iterator = map.entrySet().iterator();
            while (iterator.hasNext()) {
                Map.Entry<?, ?> entry = iterator.next();
                builder.append('"').append(escapeJson(String.valueOf(entry.getKey()))).append('"').append(':');
                appendJsonValue(builder, entry.getValue());
                if (iterator.hasNext()) {
                    builder.append(',');
                }
            }
            builder.append('}');
            return;
        }
        if (value instanceof Iterable<?> iterable) {
            builder.append('[');
            Iterator<?> iterator = iterable.iterator();
            while (iterator.hasNext()) {
                appendJsonValue(builder, iterator.next());
                if (iterator.hasNext()) {
                    builder.append(',');
                }
            }
            builder.append(']');
            return;
        }
        throw new IllegalArgumentException("不支持的 JSON 值类型: " + value.getClass().getSimpleName());
    }

    private static String escapeJson(String text) {
        return text
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\r", "\\r")
                .replace("\n", "\\n")
                .replace("\t", "\\t");
    }
}
