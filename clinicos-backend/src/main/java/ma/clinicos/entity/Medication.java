package ma.clinicos.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "medications")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Medication {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    private String name;
    private String dosage;
    private String frequency;
    private String duration;
    private String instructions;
}
