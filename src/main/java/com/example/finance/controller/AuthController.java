package com.example.finance.controller;

import com.example.finance.dto.AuthApiModels;
import com.example.finance.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public AuthApiModels.LoginResponse login(@Valid @RequestBody AuthApiModels.LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/me")
    public AuthApiModels.MeResponse me() {
        return authService.me();
    }
}
