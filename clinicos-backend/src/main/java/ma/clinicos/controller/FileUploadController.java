package ma.clinicos.controller;

import lombok.RequiredArgsConstructor;
import ma.clinicos.entity.*;
import ma.clinicos.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.file.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/documents")
@RequiredArgsConstructor
public class FileUploadController {

    private final UploadedDocumentRepository documentRepository;
    private final PatientRepository patientRepository;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @PostMapping("/upload/{patientId}")
    public ResponseEntity<UploadedDocument> upload(
            @PathVariable String patientId,
            @RequestParam MultipartFile file,
            @RequestParam(required = false) String description,
            @RequestParam(required = false, defaultValue = "OTHER") String documentType) throws IOException {

        Patient patient = patientRepository.findById(patientId).orElseThrow();
        Path uploadPath = Paths.get(uploadDir);
        Files.createDirectories(uploadPath);
        String uniqueFileName = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Path filePath = uploadPath.resolve(uniqueFileName);
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        UploadedDocument doc = UploadedDocument.builder()
            .patient(patient)
            .fileName(uniqueFileName)
            .originalFileName(file.getOriginalFilename())
            .fileType(file.getContentType())
            .fileSize(file.getSize())
            .filePath(filePath.toString())
            .documentType(UploadedDocument.DocumentType.valueOf(documentType))
            .description(description)
            .build();

        return ResponseEntity.ok(documentRepository.save(doc));
    }

    @GetMapping("/patient/{patientId}")
    public List<UploadedDocument> getForPatient(@PathVariable String patientId) {
        return documentRepository.findByPatientId(patientId);
    }
}
