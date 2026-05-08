package ma.clinicos.repository;

import ma.clinicos.entity.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PatientRepository extends JpaRepository<Patient, String> {
    List<Patient> findByFullNameContainingIgnoreCaseOrPhoneContaining(String name, String phone);
    List<Patient> findByStatus(Patient.PatientStatus status);
}
