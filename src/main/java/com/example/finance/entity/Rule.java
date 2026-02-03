package com.example.finance.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Table;
import lombok.Data;
import org.springframework.data.annotation.Id;

import java.math.BigDecimal;

@Data
@Entity
@Table(name = "rule")
public class Rule {

    @jakarta.persistence.Id
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 规则作用的消费类别，如：餐饮、交通
    private String category;

    // 阈值，如：1000 表示超出 1000 触发
    private BigDecimal threshold;

    // 触发后给用户的提示信息
    private String message;
}
