package ma.clinicos.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalTime;

public record AppointmentRequest(
    @NotBlank String patientId,
    @NotBlank String doctorId,
    @NotNull LocalDate date,
    @NotNull LocalTime time,
    Integer duration,
    String type,
    String status,
    String notes,
    String room
) {}
