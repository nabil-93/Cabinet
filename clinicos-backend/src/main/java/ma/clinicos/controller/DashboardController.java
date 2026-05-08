package ma.clinicos.controller;

import lombok.RequiredArgsConstructor;
import ma.clinicos.dto.DashboardStatsResponse;
import ma.clinicos.service.DashboardService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/stats")
    public DashboardStatsResponse getStats() {
        return dashboardService.getStats();
    }
}
