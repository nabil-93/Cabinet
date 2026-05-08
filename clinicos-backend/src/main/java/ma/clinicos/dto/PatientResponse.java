package ma.clinicos.dto;

import ma.clinicos.entity.Patient;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record PatientResponse(
    String id,
    String fullName,
    String phone,
    String email,
    LocalDate dateOfBirth,
    String gender,
    String address,
    String bloodType,
    List<String> medicalHistory,
    List<String> allergies,
    String status,
    LocalDateTime createdAt,
    LocalDateTime lastVisit
) {
    public static PatientResponse from(Patient p) {
        return new PatientResponse(
            p.getId(),
            p.getFullName(),
            p.getPhone(),
            p.getEmail(),
            p.getDateOfBirth(),
            p.getGender() != null ? p.getGender().name().toLowerCase() : null,
            p.getAddress(),
            p.getBloodType(),
            p.getMedicalHistory(),
            p.getAllergies(),
            p.getStatus() != null ? p.getStatus().name().toLowerCase() : null,
            p.getCreatedAt(),
            p.getLastVisit()
        );
    }
}
