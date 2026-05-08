package ma.clinicos.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "waiting_room")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WaitingRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id")
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "appointment_id")
    private Appointment appointment;

    private LocalDateTime arrivedAt;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private WaitingStatus status = WaitingStatus.WAITING;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Priority priority = Priority.NORMAL;

    private Integer estimatedWaitMinutes;

    @PrePersist
    protected void onCreate() {
        arrivedAt = LocalDateTime.now();
    }

    public enum WaitingStatus { WAITING, IN_PROGRESS, DONE }
    public enum Priority { NORMAL, URGENT }
}
