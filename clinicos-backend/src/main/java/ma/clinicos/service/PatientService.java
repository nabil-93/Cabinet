package ma.clinicos.service;

import lombok.RequiredArgsConstructor;
import ma.clinicos.dto.PatientRequest;
import ma.clinicos.dto.PatientResponse;
import ma.clinicos.entity.Patient;
import ma.clinicos.repository.PatientRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PatientService {

    private final PatientRepository patientRepository;

    public List<PatientResponse> findAll() {
        return patientRepository.findAll().stream()
            .map(PatientResponse::from)
            .collect(Collectors.toList());
    }

    public PatientResponse findById(String id) {
        return patientRepository.findById(id)
            .map(PatientResponse::from)
            .orElseThrow(() -> new RuntimeException("Patient not found: " + id));
    }

    public List<PatientResponse> search(String query) {
        return patientRepository.findByFullNameContainingIgnoreCaseOrPhoneContaining(query, query)
            .stream()
            .map(PatientResponse::from)
            .collect(Collectors.toList());
    }

    @Transactional
    public PatientResponse create(PatientRequest req) {
        Patient p = Patient.builder()
            .fullName(req.fullName())
            .phone(req.phone())
            .email(req.email())
            .dateOfBirth(req.dateOfBirth())
            .gender(req.gender() != null ? Patient.Gender.valueOf(req.gender().toUpperCase()) : null)
            .address(req.address())
            .bloodType(req.bloodType())
            .medicalHistory(req.medicalHistory())
            .allergies(req.allergies())
            .status(Patient.PatientStatus.ACTIVE)
            .build();
        return PatientResponse.from(patientRepository.save(p));
    }

    @Transactional
    public PatientResponse update(String id, PatientRequest req) {
        Patient p = patientRepository.findById(id).orElseThrow();
        p.setFullName(req.fullName());
        p.setPhone(req.phone());
        p.setEmail(req.email());
        p.setDateOfBirth(req.dateOfBirth());
        if (req.gender() != null) {
            p.setGender(Patient.Gender.valueOf(req.gender().toUpperCase()));
        }
        p.setAddress(req.address());
        p.setBloodType(req.bloodType());
        p.setMedicalHistory(req.medicalHistory());
        p.setAllergies(req.allergies());
        return PatientResponse.from(patientRepository.save(p));
    }

    @Transactional
    public void delete(String id) {
        patientRepository.deleteById(id);
    }
}
