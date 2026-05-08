package ma.clinicos.dto;

import ma.clinicos.entity.Appointment;
import java.time.LocalDate;
import java.time.LocalTime;

public record AppointmentResponse(
    String id,
    String patientId,
    String patientName,
    String doctorId,
    String doctorName,
    LocalDate date,
    LocalTime time,
    Integer duration,
    String type,
    String status,
    String notes,
    String room
) {
    public static AppointmentResponse from(Appointment a) {
        return new AppointmentResponse(
            a.getId(),
            a.getPatient().getId(),
            a.getPatient().getFullName(),
            a.getDoctor().getId(),
            a.getDoctor().getName(),
            a.getDate(),
            a.getTime(),
            a.getDuration(),
            a.getType(),
            a.getStatus().name().toLowerCase(),
            a.getNotes(),
            a.getRoom()
        );
    }
}
