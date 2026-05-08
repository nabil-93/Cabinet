package ma.clinicos.service;

import lombok.RequiredArgsConstructor;
import ma.clinicos.dto.PrescriptionResponse;
import ma.clinicos.repository.PrescriptionRepository;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PrescriptionService {

    private final PrescriptionRepository prescriptionRepository;

    public List<PrescriptionResponse> findAll() {
        return prescriptionRepository.findAll().stream()
            .map(PrescriptionResponse::from)
            .collect(Collectors.toList());
    }

    public List<PrescriptionResponse> findByPatient(String patientId) {
        return prescriptionRepository.findByPatientId(patientId).stream()
            .map(PrescriptionResponse::from)
            .collect(Collectors.toList());
    }
}
