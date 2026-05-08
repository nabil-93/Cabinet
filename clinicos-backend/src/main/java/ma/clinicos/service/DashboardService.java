package ma.clinicos.service;

import lombok.RequiredArgsConstructor;
import ma.clinicos.dto.DashboardStatsResponse;
import ma.clinicos.entity.Appointment;
import ma.clinicos.entity.Invoice;
import ma.clinicos.entity.WaitingRoom;
import ma.clinicos.repository.*;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final PatientRepository patientRepository;
    private final AppointmentRepository appointmentRepository;
    private final InvoiceRepository invoiceRepository;
    private final WaitingRoomRepository waitingRoomRepository;

    public DashboardStatsResponse getStats() {
        LocalDate today = LocalDate.now();

        long totalPatients = patientRepository.count();

        long todayApts = appointmentRepository.countByDateAndStatus(today, Appointment.AppointmentStatus.CONFIRMED)
            + appointmentRepository.countByDateAndStatus(today, Appointment.AppointmentStatus.PENDING);

        BigDecimal revenue = invoiceRepository.sumRevenueByMonthAndYear(today.getMonthValue(), today.getYear());

        long pendingInvoices = invoiceRepository.countByStatus(Invoice.PaymentStatus.UNPAID);

        long waitingRoom = waitingRoomRepository
            .findByStatusOrderByArrivedAtAsc(WaitingRoom.WaitingStatus.WAITING).size();

        long completedToday = appointmentRepository.countByDateAndStatus(
            today, Appointment.AppointmentStatus.COMPLETED);

        return new DashboardStatsResponse(
            totalPatients,
            todayApts,
            revenue != null ? revenue : BigDecimal.ZERO,
            pendingInvoices,
            waitingRoom,
            completedToday
        );
    }
}
