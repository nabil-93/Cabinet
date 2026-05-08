package ma.clinicos.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "uploaded_documents")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UploadedDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id")
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by")
    private User uploadedBy;

    private String fileName;
    private String originalFileName;
    private String fileType;
    private Long fileSize;
    private String filePath;

    @Enumerated(EnumType.STRING)
    private DocumentType documentType;

    private String description;
    private LocalDateTime uploadedAt;

    @PrePersist
    protected void onCreate() {
        uploadedAt = LocalDateTime.now();
    }

    public enum DocumentType { MEDICAL_REPORT, XRAY, PRESCRIPTION, LAB_RESULT, OTHER }
}
