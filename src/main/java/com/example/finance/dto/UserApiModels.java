package com.example.finance.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class UserApiModels {

    private UserApiModels() {
    }

    public record CreateRequest(
            @NotBlank @Size(max = 50) String username,
            @NotBlank @Size(min = 6, max = 100) String password,
            @NotBlank @Size(max = 50) String nickname,
            @Size(max = 50) String realName,
            @Size(max = 20) String phone,
            @Email @Size(max = 100) String email,
            @Size(max = 20) String userType
    ) {
    }

    public record Response(
            Long id,
            String username,
            String nickname,
            String realName,
            String phone,
            String email,
            String userType,
            Integer status
    ) {
    }
}
