package ma.clinicos.dto;

import ma.clinicos.entity.Prescription;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

public record PrescriptionResponse(
    String id,
    String patientId,
    String patientName,
    String doctorId,
    String doctorName,
    LocalDate date,
    String diagnosis,
    String notes,
    String status,
    List<MedicationDto> medications
) {
    public record MedicationDto(
        String name,
        String dosage,
        String frequency,
        String duration,
        String instructions
    ) {}

    public static PrescriptionResponse from(Prescription p) {
        var meds = p.getMedications() == null ? List.<MedicationDto>of() :
            p.getMedications().stream()
                .map(m -> new MedicationDto(
                    m.getName(),
                    m.getDosage(),
                    m.getFrequency(),
                    m.getDuration(),
                    m.getInstructions()
                ))
                .collect(Collectors.toList());

        return new PrescriptionResponse(
            p.getId(),
            p.getPatient().getId(),
            p.getPatient().getFullName(),
            p.getDoctor().getId(),
            p.getDoctor().getName(),
            p.getDate(),
            p.getDiagnosis(),
            p.getNotes(),
            p.getStatus().name().toLowerCase(),
            meds
        );
    }
}
