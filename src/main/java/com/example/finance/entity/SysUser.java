package com.example.finance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "sys_user",
        indexes = {
                @Index(name = "uk_sys_user_username", columnList = "username", unique = true),
                @Index(name = "uk_sys_user_phone", columnList = "phone", unique = true),
                @Index(name = "uk_sys_user_email", columnList = "email", unique = true),
                @Index(name = "idx_sys_user_status", columnList = "status")
        }
)
public class SysUser extends AbstractAuditEntity {

    @Column(name = "username", nullable = false, length = 50)
    private String username;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "nickname", nullable = false, length = 50)
    private String nickname;

    @Column(name = "real_name", length = 50)
    private String realName;

    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "avatar_url", length = 255)
    private String avatarUrl;

    @Column(name = "user_type", nullable = false, length = 20)
    private String userType = "USER";

    @Column(name = "status", nullable = false)
    private Integer status = 1;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;
}
