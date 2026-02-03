package com.example.finance.util;

import com.example.finance.entity.Transaction;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class CsvParserUtil {

    public static List<Transaction> parse(MultipartFile file) throws Exception {
        List<Transaction> list = new ArrayList<>();

        BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8)
        );

        String line;
        while ((line = reader.readLine()) != null) {
            String[] arr = line.split(",");
            Transaction t = new Transaction();
            t.setAmount(new BigDecimal(arr[1]));
            t.setCategory(arr[2]);
            t.setTime(LocalDateTime.parse(arr[0]));
            list.add(t);
        }
        return list;
    }
}

