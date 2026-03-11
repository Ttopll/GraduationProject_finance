CREATE DATABASE IF NOT EXISTS finance_system
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE finance_system;

DROP TABLE IF EXISTS data_export_log;
DROP TABLE IF EXISTS financial_advice;
DROP TABLE IF EXISTS family_financial_profile;
DROP TABLE IF EXISTS notification;
DROP TABLE IF EXISTS rule_execution_log;
DROP TABLE IF EXISTS rule_definition;
DROP TABLE IF EXISTS debt_repayment;
DROP TABLE IF EXISTS debt;
DROP TABLE IF EXISTS fixed_asset;
DROP TABLE IF EXISTS budget_plan;
DROP TABLE IF EXISTS bill_import_pending_item;
DROP TABLE IF EXISTS transaction_record;
DROP TABLE IF EXISTS bill_parse_rule;
DROP TABLE IF EXISTS bill_import_batch;
DROP TABLE IF EXISTS account;
DROP TABLE IF EXISTS category;
DROP TABLE IF EXISTS family_member;
DROP TABLE IF EXISTS family;
DROP TABLE IF EXISTS sys_user;

CREATE TABLE sys_user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    real_name VARCHAR(50) NULL,
    phone VARCHAR(20) NULL,
    email VARCHAR(100) NULL,
    avatar_url VARCHAR(255) NULL,
    user_type VARCHAR(20) NOT NULL DEFAULT 'USER',
    status TINYINT NOT NULL DEFAULT 1,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_sys_user_username (username),
    UNIQUE KEY uk_sys_user_phone (phone),
    UNIQUE KEY uk_sys_user_email (email),
    KEY idx_sys_user_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE family (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    family_name VARCHAR(100) NOT NULL,
    owner_user_id BIGINT NOT NULL,
    invite_code VARCHAR(20) NOT NULL,
    currency_code VARCHAR(10) NOT NULL DEFAULT 'CNY',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Shanghai',
    status TINYINT NOT NULL DEFAULT 1,
    remark VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_family_invite_code (invite_code),
    KEY idx_family_owner_user_id (owner_user_id),
    CONSTRAINT fk_family_owner_user
        FOREIGN KEY (owner_user_id) REFERENCES sys_user (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE family_member (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    family_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    member_name VARCHAR(50) NULL,
    role_code VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    permission_json JSON NULL,
    status TINYINT NOT NULL DEFAULT 1,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_family_member_family_user (family_id, user_id),
    KEY idx_family_member_user_id (user_id),
    KEY idx_family_member_role_code (role_code),
    CONSTRAINT fk_family_member_family
        FOREIGN KEY (family_id) REFERENCES family (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_family_member_user
        FOREIGN KEY (user_id) REFERENCES sys_user (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE category (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    family_id BIGINT NULL,
    parent_id BIGINT NULL,
    category_name VARCHAR(50) NOT NULL,
    category_type VARCHAR(20) NOT NULL,
    scope_type VARCHAR(20) NOT NULL DEFAULT 'FAMILY',
    icon_code VARCHAR(50) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    enabled TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_category_family_id (family_id),
    KEY idx_category_parent_id (parent_id),
    KEY idx_category_type_enabled (category_type, enabled),
    CONSTRAINT fk_category_family
        FOREIGN KEY (family_id) REFERENCES family (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_category_parent
        FOREIGN KEY (parent_id) REFERENCES category (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE account (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    family_id BIGINT NOT NULL,
    owner_member_id BIGINT NULL,
    account_name VARCHAR(50) NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    institution_name VARCHAR(100) NULL,
    account_no_mask VARCHAR(64) NULL,
    current_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    credit_limit DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    billing_day TINYINT NULL,
    repayment_day TINYINT NULL,
    is_shared TINYINT NOT NULL DEFAULT 1,
    status TINYINT NOT NULL DEFAULT 1,
    remark VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_account_family_id (family_id),
    KEY idx_account_owner_member_id (owner_member_id),
    KEY idx_account_type_status (account_type, status),
    CONSTRAINT fk_account_family
        FOREIGN KEY (family_id) REFERENCES family (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_account_owner_member
        FOREIGN KEY (owner_member_id) REFERENCES family_member (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE bill_import_batch (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    family_id BIGINT NOT NULL,
    uploaded_by_member_id BIGINT NOT NULL,
    source_platform VARCHAR(20) NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64) NULL,
    file_path VARCHAR(255) NULL,
    total_count INT NOT NULL DEFAULT 0,
    success_count INT NOT NULL DEFAULT 0,
    fail_count INT NOT NULL DEFAULT 0,
    import_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    error_summary VARCHAR(500) NULL,
    imported_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_bill_import_batch_family_id (family_id),
    KEY idx_bill_import_batch_uploaded_by (uploaded_by_member_id),
    KEY idx_bill_import_batch_status (import_status),
    KEY idx_bill_import_batch_family_hash (family_id, file_hash),
    CONSTRAINT fk_bill_import_batch_family
        FOREIGN KEY (family_id) REFERENCES family (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bill_import_batch_member
        FOREIGN KEY (uploaded_by_member_id) REFERENCES family_member (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE bill_parse_rule (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    family_id BIGINT NULL,
    category_id BIGINT NOT NULL,
    merchant_keyword VARCHAR(100) NULL,
    regex_pattern VARCHAR(255) NULL,
    priority INT NOT NULL DEFAULT 100,
    enabled TINYINT NOT NULL DEFAULT 1,
    hit_count INT NOT NULL DEFAULT 0,
    last_hit_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_bill_parse_rule_family_id (family_id),
    KEY idx_bill_parse_rule_category_id (category_id),
    KEY idx_bill_parse_rule_priority_enabled (priority, enabled),
    CONSTRAINT fk_bill_parse_rule_family
        FOREIGN KEY (family_id) REFERENCES family (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bill_parse_rule_category
        FOREIGN KEY (category_id) REFERENCES category (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE transaction_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    family_id BIGINT NOT NULL,
    account_id BIGINT NOT NULL,
    target_account_id BIGINT NULL,
    category_id BIGINT NULL,
    created_by_member_id BIGINT NULL,
    source_batch_id BIGINT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    transaction_time DATETIME NOT NULL,
    merchant_name VARCHAR(100) NULL,
    counterparty_name VARCHAR(100) NULL,
    source_platform VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    external_trade_no VARCHAR(64) NULL,
    note VARCHAR(255) NULL,
    status TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_transaction_record_family_time (family_id, transaction_time),
    KEY idx_transaction_record_account_time (account_id, transaction_time),
    KEY idx_transaction_record_category_time (category_id, transaction_time),
    KEY idx_transaction_record_source_batch_id (source_batch_id),
    KEY idx_transaction_record_platform_trade_no (source_platform, external_trade_no),
    CONSTRAINT fk_transaction_record_family
        FOREIGN KEY (family_id) REFERENCES family (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_transaction_record_account
        FOREIGN KEY (account_id) REFERENCES account (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_transaction_record_target_account
        FOREIGN KEY (target_account_id) REFERENCES account (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_transaction_record_category
        FOREIGN KEY (category_id) REFERENCES category (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_transaction_record_member
        FOREIGN KEY (created_by_member_id) REFERENCES family_member (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_transaction_record_batch
        FOREIGN KEY (source_batch_id) REFERENCES bill_import_batch (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE bill_import_pending_item (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    family_id BIGINT NOT NULL,
    source_batch_id BIGINT NOT NULL,
    transaction_record_id BIGINT NULL,
    source_platform VARCHAR(20) NOT NULL,
    external_trade_no VARCHAR(64) NULL,
    merchant_name VARCHAR(100) NULL,
    raw_category_name VARCHAR(100) NULL,
    transaction_type VARCHAR(20) NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    transaction_time DATETIME NOT NULL,
    note VARCHAR(255) NULL,
    raw_line TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    resolved_category_id BIGINT NULL,
    resolved_by_member_id BIGINT NULL,
    resolved_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_bill_import_pending_family_status (family_id, status),
    KEY idx_bill_import_pending_batch_id (source_batch_id),
    KEY idx_bill_import_pending_record_id (transaction_record_id),
    CONSTRAINT fk_bill_import_pending_family
        FOREIGN KEY (family_id) REFERENCES family (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bill_import_pending_batch
        FOREIGN KEY (source_batch_id) REFERENCES bill_import_batch (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bill_import_pending_record
        FOREIGN KEY (transaction_record_id) REFERENCES transaction_record (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_bill_import_pending_category
        FOREIGN KEY (resolved_category_id) REFERENCES category (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_bill_import_pending_member
        FOREIGN KEY (resolved_by_member_id) REFERENCES family_member (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE budget_plan (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    family_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    created_by_member_id BIGINT NULL,
    budget_name VARCHAR(100) NOT NULL,
    period_type VARCHAR(20) NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    alert_ratio DECIMAL(5,2) NOT NULL DEFAULT 0.80,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    enabled TINYINT NOT NULL DEFAULT 1,
    remark VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_budget_plan_family_id (family_id),
    KEY idx_budget_plan_category_id (category_id),
    KEY idx_budget_plan_period_enabled (period_type, enabled),
    CONSTRAINT fk_budget_plan_family
        FOREIGN KEY (family_id) REFERENCES family (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_budget_plan_category
        FOREIGN KEY (category_id) REFERENCES category (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_budget_plan_member
        FOREIGN KEY (created_by_member_id) REFERENCES family_member (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE debt (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    family_id BIGINT NOT NULL,
    debtor_member_id BIGINT NULL,
    debt_name VARCHAR(100) NOT NULL,
    debt_type VARCHAR(20) NOT NULL,
    lender_name VARCHAR(100) NULL,
    principal_amount DECIMAL(14,2) NOT NULL,
    current_balance DECIMAL(14,2) NOT NULL,
    annual_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    billing_day TINYINT NULL,
    repayment_day TINYINT NULL,
    due_date DATE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    remark VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_debt_family_id (family_id),
    KEY idx_debt_debtor_member_id (debtor_member_id),
    KEY idx_debt_status_due_date (status, due_date),
    CONSTRAINT fk_debt_family
        FOREIGN KEY (family_id) REFERENCES family (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_debt_member
        FOREIGN KEY (debtor_member_id) REFERENCES family_member (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE debt_repayment (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    debt_id BIGINT NOT NULL,
    family_id BIGINT NOT NULL,
    pay_account_id BIGINT NULL,
    created_by_member_id BIGINT NULL,
    amount DECIMAL(14,2) NOT NULL,
    principal_paid DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    interest_paid DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    repayment_time DATETIME NOT NULL,
    note VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_debt_repayment_debt_id (debt_id),
    KEY idx_debt_repayment_family_id (family_id),
    KEY idx_debt_repayment_time (repayment_time),
    CONSTRAINT fk_debt_repayment_debt
        FOREIGN KEY (debt_id) REFERENCES debt (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_debt_repayment_family
        FOREIGN KEY (family_id) REFERENCES family (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_debt_repayment_account
        FOREIGN KEY (pay_account_id) REFERENCES account (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_debt_repayment_member
        FOREIGN KEY (created_by_member_id) REFERENCES family_member (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE fixed_asset (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    family_id BIGINT NOT NULL,
    owner_member_id BIGINT NULL,
    asset_name VARCHAR(100) NOT NULL,
    asset_type VARCHAR(20) NOT NULL,
    purchase_amount DECIMAL(14,2) NOT NULL,
    purchase_date DATE NULL,
    valuation_amount DECIMAL(14,2) NULL,
    valuation_date DATE NULL,
    remark VARCHAR(255) NULL,
    status TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_fixed_asset_family_id (family_id),
    KEY idx_fixed_asset_owner_member_id (owner_member_id),
    KEY idx_fixed_asset_type_status (asset_type, status),
    CONSTRAINT fk_fixed_asset_family
        FOREIGN KEY (family_id) REFERENCES family (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_fixed_asset_member
        FOREIGN KEY (owner_member_id) REFERENCES family_member (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE rule_definition (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    family_id BIGINT NOT NULL,
    category_id BIGINT NULL,
    created_by_member_id BIGINT NULL,
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(30) NOT NULL,
    metric_type VARCHAR(30) NOT NULL,
    time_scope VARCHAR(20) NOT NULL DEFAULT 'MONTH',
    operator_type VARCHAR(10) NOT NULL,
    threshold_value DECIMAL(14,2) NULL,
    threshold_json JSON NULL,
    action_type VARCHAR(20) NOT NULL,
    message_template VARCHAR(255) NOT NULL,
    enabled TINYINT NOT NULL DEFAULT 1,
    priority INT NOT NULL DEFAULT 100,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_rule_definition_family_id (family_id),
    KEY idx_rule_definition_category_id (category_id),
    KEY idx_rule_definition_type_enabled (rule_type, enabled),
    CONSTRAINT fk_rule_definition_family
        FOREIGN KEY (family_id) REFERENCES family (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_rule_definition_category
        FOREIGN KEY (category_id) REFERENCES category (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_rule_definition_member
        FOREIGN KEY (created_by_member_id) REFERENCES family_member (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE rule_execution_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    rule_id BIGINT NOT NULL,
    family_id BIGINT NOT NULL,
    result_status VARCHAR(20) NOT NULL,
    metric_value DECIMAL(14,2) NULL,
    context_json JSON NULL,
    message_snapshot VARCHAR(255) NULL,
    trigger_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_rule_execution_log_rule_id (rule_id),
    KEY idx_rule_execution_log_family_id (family_id),
    KEY idx_rule_execution_log_status_time (result_status, trigger_time),
    CONSTRAINT fk_rule_execution_log_rule
        FOREIGN KEY (rule_id) REFERENCES rule_definition (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_rule_execution_log_family
        FOREIGN KEY (family_id) REFERENCES family (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE notification (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    family_id BIGINT NOT NULL,
    target_member_id BIGINT NULL,
    source_type VARCHAR(20) NOT NULL,
    source_id BIGINT NULL,
    title VARCHAR(100) NOT NULL,
    content VARCHAR(500) NOT NULL,
    level_code VARCHAR(20) NOT NULL DEFAULT 'INFO',
    read_status TINYINT NOT NULL DEFAULT 0,
    sent_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_notification_family_id (family_id),
    KEY idx_notification_target_member_id (target_member_id),
    KEY idx_notification_read_status_created_at (read_status, created_at),
    CONSTRAINT fk_notification_family
        FOREIGN KEY (family_id) REFERENCES family (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_notification_member
        FOREIGN KEY (target_member_id) REFERENCES family_member (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE family_financial_profile (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    family_id BIGINT NOT NULL,
    risk_preference VARCHAR(20) NOT NULL DEFAULT 'LOW',
    savings_target_rate DECIMAL(5,2) NULL,
    emergency_fund_months INT NULL,
    investment_preference_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_family_financial_profile_family_id (family_id),
    CONSTRAINT fk_family_financial_profile_family
        FOREIGN KEY (family_id) REFERENCES family (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE financial_advice (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    family_id BIGINT NOT NULL,
    rule_id BIGINT NULL,
    advice_type VARCHAR(20) NOT NULL,
    title VARCHAR(100) NOT NULL,
    content VARCHAR(500) NOT NULL,
    suggestion_level VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    snapshot_json JSON NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UNREAD',
    generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_financial_advice_family_id (family_id),
    KEY idx_financial_advice_rule_id (rule_id),
    KEY idx_financial_advice_status_generated_at (status, generated_at),
    CONSTRAINT fk_financial_advice_family
        FOREIGN KEY (family_id) REFERENCES family (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_financial_advice_rule
        FOREIGN KEY (rule_id) REFERENCES rule_definition (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE data_export_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    family_id BIGINT NOT NULL,
    requested_by_member_id BIGINT NULL,
    export_type VARCHAR(30) NOT NULL,
    file_format VARCHAR(20) NOT NULL,
    file_path VARCHAR(255) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_data_export_log_family_id (family_id),
    KEY idx_data_export_log_member_id (requested_by_member_id),
    KEY idx_data_export_log_status_created_at (status, created_at),
    CONSTRAINT fk_data_export_log_family
        FOREIGN KEY (family_id) REFERENCES family (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_data_export_log_member
        FOREIGN KEY (requested_by_member_id) REFERENCES family_member (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
