package com.example.finance.util;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;

public final class PeriodRangeUtil {

    private PeriodRangeUtil() {
    }

    public static YearMonth resolveMonth(String monthText) {
        return monthText == null || monthText.isBlank()
                ? YearMonth.now()
                : YearMonth.parse(monthText.trim());
    }

    public static LocalDateTime[] monthRange(YearMonth yearMonth) {
        return new LocalDateTime[]{
                yearMonth.atDay(1).atStartOfDay(),
                yearMonth.plusMonths(1).atDay(1).atStartOfDay().minusNanos(1)
        };
    }

    public static LocalDateTime[] yearRange(int year) {
        return new LocalDateTime[]{
                LocalDate.of(year, 1, 1).atStartOfDay(),
                LocalDate.of(year, 12, 31).atTime(23, 59, 59, 999_999_999)
        };
    }
}
