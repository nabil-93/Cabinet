package ma.clinicos.repository;

import ma.clinicos.entity.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import java.util.List;

public interface AppointmentRepository extends JpaRepository<Appointment, String> {

    List<Appointment> findByDate(LocalDate date);

    List<Appointment> findByDateBetween(LocalDate start, LocalDate end);

    List<Appointment> findByPatientId(String patientId);

    List<Appointment> findByDoctorId(String doctorId);

    List<Appointment> findByStatus(Appointment.AppointmentStatus status);

    @Query("SELECT a FROM Appointment a WHERE a.date = :date AND a.doctor.id = :doctorId ORDER BY a.time")
    List<Appointment> findByDateAndDoctorId(LocalDate date, String doctorId);

    long countByDateAndStatus(LocalDate date, Appointment.AppointmentStatus status);
}
