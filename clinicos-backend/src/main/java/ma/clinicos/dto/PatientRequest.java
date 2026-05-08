package ma.clinicos.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;

public record PatientRequest(
    @NotBlank String fullName,
    @NotBlank String phone,
    String email,
    LocalDate dateOfBirth,
    String gender,
    String address,
    String bloodType,
    List<String> medicalHistory,
    List<String> allergies
) {}
