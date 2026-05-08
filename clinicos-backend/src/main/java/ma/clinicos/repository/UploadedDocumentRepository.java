package ma.clinicos.repository;

import ma.clinicos.entity.UploadedDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface UploadedDocumentRepository extends JpaRepository<UploadedDocument, String> {

    List<UploadedDocument> findByPatientId(String patientId);
}
