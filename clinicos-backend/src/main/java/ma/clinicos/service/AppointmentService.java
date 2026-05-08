package ma.clinicos.service;

import lombok.RequiredArgsConstructor;
import ma.clinicos.dto.AppointmentRequest;
import ma.clinicos.dto.AppointmentResponse;
import ma.clinicos.entity.Appointment;
import ma.clinicos.repository.AppointmentRepository;
import ma.clinicos.repository.PatientRepository;
import ma.clinicos.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final PatientRepository patientRepository;
    private final UserRepository userRepository;

    public List<AppointmentResponse> findAll() {
        return appointmentRepository.findAll().stream()
            .map(AppointmentResponse::from)
            .collect(Collectors.toList());
    }

    public List<AppointmentResponse> findByDate(LocalDate date) {
        return appointmentRepository.findByDate(date).stream()
            .map(AppointmentResponse::from)
            .collect(Collectors.toList());
    }

    public List<AppointmentResponse> findByPatient(String patientId) {
        return appointmentRepository.findByPatientId(patientId).stream()
            .map(AppointmentResponse::from)
            .collect(Collectors.toList());
    }

    @Transactional
    public AppointmentResponse create(AppointmentRequest req) {
        var patient = patientRepository.findById(req.patientId()).orElseThrow();
        var doctor = userRepository.findById(req.doctorId()).orElseThrow();
        var apt = Appointment.builder()
            .patient(patient)
            .doctor(doctor)
            .date(req.date())
            .time(req.time())
            .duration(req.duration())
            .type(req.type())
            .status(Appointment.AppointmentStatus.PENDING)
            .notes(req.notes())
            .room(req.room())
            .build();
        return AppointmentResponse.from(appointmentRepository.save(apt));
    }

    @Transactional
    public AppointmentResponse updateStatus(String id, String status) {
        Appointment apt = appointmentRepository.findById(id).orElseThrow();
        apt.setStatus(Appointment.AppointmentStatus.valueOf(status.toUpperCase()));
        return AppointmentResponse.from(appointmentRepository.save(apt));
    }

    @Transactional
    public void delete(String id) {
        appointmentRepository.deleteById(id);
    }
}
