package com.example.finance.util;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CsvParserUtilTests {

    @Test
    void shouldParseWechatCsvWithTradeNoAndExpenseType() throws Exception {
        String content = """
                交易时间,交易类型,交易对方,商品,收/支,金额(元),交易单号,备注
                2026-03-10 12:30:00,餐饮美食,瑞幸咖啡,生椰拿铁,支出,18.50,wx20260310001,午餐
                """;
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "wechat.csv",
                "text/csv",
                content.getBytes(StandardCharsets.UTF_8)
        );

        CsvParserUtil.ParseResult result = CsvParserUtil.parse(file, "WECHAT");

        assertEquals(1, result.rows().size());
        assertTrue(result.errors().isEmpty());
        assertEquals("EXPENSE", result.rows().get(0).transactionType());
        assertEquals("瑞幸咖啡", result.rows().get(0).merchantName());
        assertEquals("wx20260310001", result.rows().get(0).externalTradeNo());
    }

    @Test
    void shouldFallbackToGbkForAlipayCsv() throws Exception {
        String content = """
                交易创建时间,交易对方,商品名称,收/支,金额（元）,交易号,备注
                2026-03-10 08:45:00,支付宝商家,早餐,支出,12.00,2026031000001,豆浆油条
                """;
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "alipay.csv",
                "text/csv",
                content.getBytes(Charset.forName("GBK"))
        );

        CsvParserUtil.ParseResult result = CsvParserUtil.parse(file, "ALIPAY");

        assertEquals(1, result.rows().size());
        assertTrue(result.errors().isEmpty());
        assertEquals("支付宝商家", result.rows().get(0).merchantName());
        assertEquals("2026031000001", result.rows().get(0).externalTradeNo());
        assertEquals("EXPENSE", result.rows().get(0).transactionType());
    }
}
