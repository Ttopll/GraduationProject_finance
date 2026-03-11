package com.example.finance.controller;

import com.example.finance.dto.UserApiModels;
import com.example.finance.entity.SysUser;
import com.example.finance.security.CurrentUserService;
import com.example.finance.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final CurrentUserService currentUserService;

    public UserController(UserService userService, CurrentUserService currentUserService) {
        this.userService = userService;
        this.currentUserService = currentUserService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserApiModels.Response create(@Valid @RequestBody UserApiModels.CreateRequest request) {
        return toResponse(userService.create(request));
    }

    @GetMapping
    public List<UserApiModels.Response> list() {
        currentUserService.requireAdmin();
        return userService.listAll().stream()
                .map(UserController::toResponse)
                .toList();
    }

    private static UserApiModels.Response toResponse(SysUser user) {
        return new UserApiModels.Response(
                user.getId(),
                user.getUsername(),
                user.getNickname(),
                user.getRealName(),
                user.getPhone(),
                user.getEmail(),
                user.getUserType(),
                user.getStatus()
        );
    }
}
