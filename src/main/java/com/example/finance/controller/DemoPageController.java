package com.example.finance.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class DemoPageController {

    @GetMapping({"/demo", "/demo/"})
    public String demoPage() {
        return "redirect:/demo/index.html";
    }
}
