package ma.clinicos.dto;

import java.math.BigDecimal;

public record DashboardStatsResponse(
    long totalPatients,
    long todayAppointments,
    BigDecimal monthlyRevenue,
    long pendingInvoices,
    long waitingRoom,
    long completedToday
) {}
