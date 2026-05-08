package ma.clinicos.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ma.clinicos.entity.*;
import ma.clinicos.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class DataInitializer {

    private final PasswordEncoder passwordEncoder;

    @Bean
    @Profile("dev")
    CommandLineRunner initDevData(
            UserRepository userRepo,
            PatientRepository patientRepo,
            AppointmentRepository appointmentRepo,
            InvoiceRepository invoiceRepo,
            PrescriptionRepository prescriptionRepo,
            NotificationRepository notifRepo
    ) {
        return args -> {
            log.info("=== Initialisation des données de démonstration ===");

            // ── Users ──
            User admin = userRepo.save(User.builder()
                    .name("Admin ClinicOS").email("admin@clinicos.ma")
                    .password(passwordEncoder.encode("admin123"))
                    .role(User.Role.ADMIN).enabled(true).build());

            User doctor = userRepo.save(User.builder()
                    .name("Dr. Karim Bensalem").email("doctor@clinicos.ma")
                    .password(passwordEncoder.encode("doctor123"))
                    .role(User.Role.DOCTOR).specialty("Cardiologie").enabled(true).build());

            User assistant = userRepo.save(User.builder()
                    .name("Sara Secrétaire").email("assistant@clinicos.ma")
                    .password(passwordEncoder.encode("doctor123"))
                    .role(User.Role.ASSISTANT).enabled(true).build());

            // ── Patients ──
            Patient p1 = patientRepo.save(Patient.builder()
                    .fullName("Amina Benali").phone("+212 660 111 222").email("amina.benali@email.com")
                    .dateOfBirth(LocalDate.of(1990, 4, 12)).gender(Patient.Gender.FEMALE)
                    .address("12 Rue Hassan II, Casablanca").bloodType("A+")
                    .medicalHistory(List.of("Hypertension", "Diabète type 2"))
                    .allergies(List.of("Pénicilline")).status(Patient.PatientStatus.ACTIVE).build());

            Patient p2 = patientRepo.save(Patient.builder()
                    .fullName("Youssef Alaoui").phone("+212 662 333 444").email("y.alaoui@email.com")
                    .dateOfBirth(LocalDate.of(1985, 9, 23)).gender(Patient.Gender.MALE)
                    .address("45 Avenue Mohammed V, Rabat").bloodType("O+")
                    .medicalHistory(List.of("Asthme")).allergies(List.of())
                    .status(Patient.PatientStatus.ACTIVE).build());

            Patient p3 = patientRepo.save(Patient.builder()
                    .fullName("Fatima Zahra El Idrissi").phone("+212 663 555 666").email("fz.elidrissi@email.com")
                    .dateOfBirth(LocalDate.of(1978, 12, 5)).gender(Patient.Gender.FEMALE)
                    .address("8 Rue Al Qods, Marrakech").bloodType("B+")
                    .medicalHistory(List.of("Migraine chronique"))
                    .allergies(List.of("Aspirine")).status(Patient.PatientStatus.ACTIVE).build());

            Patient p4 = patientRepo.save(Patient.builder()
                    .fullName("Omar Tazi").phone("+212 664 777 888").email("o.tazi@email.com")
                    .dateOfBirth(LocalDate.of(1965, 6, 18)).gender(Patient.Gender.MALE)
                    .address("27 Boulevard Zerktouni, Fès").bloodType("AB-")
                    .medicalHistory(List.of("Insuffisance cardiaque", "Hypertension"))
                    .allergies(List.of("Sulfamides")).status(Patient.PatientStatus.ACTIVE).build());

            Patient p5 = patientRepo.save(Patient.builder()
                    .fullName("Nadia Cherkaoui").phone("+212 665 999 000").email("n.cherkaoui@email.com")
                    .dateOfBirth(LocalDate.of(1995, 2, 28)).gender(Patient.Gender.FEMALE)
                    .address("3 Rue Ibn Battouta, Tanger").bloodType("A-")
                    .medicalHistory(List.of()).allergies(List.of())
                    .status(Patient.PatientStatus.ACTIVE).build());

            Patient p6 = patientRepo.save(Patient.builder()
                    .fullName("Mehdi Benkirane").phone("+212 666 123 789").email("m.benkirane@email.com")
                    .dateOfBirth(LocalDate.of(1972, 8, 14)).gender(Patient.Gender.MALE)
                    .address("15 Avenue Hassan II, Agadir").bloodType("O-")
                    .medicalHistory(List.of("Diabète type 1")).allergies(List.of("Latex"))
                    .status(Patient.PatientStatus.INACTIVE).build());

            Patient p7 = patientRepo.save(Patient.builder()
                    .fullName("Sara Mansouri").phone("+212 667 456 012").email("s.mansouri@email.com")
                    .dateOfBirth(LocalDate.of(2000, 11, 11)).gender(Patient.Gender.FEMALE)
                    .address("6 Rue des Orangers, Meknès").bloodType("B-")
                    .medicalHistory(List.of("Anémie")).allergies(List.of())
                    .status(Patient.PatientStatus.ACTIVE).build());

            Patient p8 = patientRepo.save(Patient.builder()
                    .fullName("Rachid Ouali").phone("+212 668 789 345").email("r.ouali@email.com")
                    .dateOfBirth(LocalDate.of(1958, 3, 30)).gender(Patient.Gender.MALE)
                    .address("21 Rue de la Paix, Oujda").bloodType("AB+")
                    .medicalHistory(List.of("Arthrite", "Hypertension"))
                    .allergies(List.of("Pénicilline", "Iode"))
                    .status(Patient.PatientStatus.ACTIVE).build());

            // ── Appointments ──
            LocalDate today = LocalDate.now();

            appointmentRepo.save(Appointment.builder().patient(p1).doctor(doctor)
                    .date(today).time(LocalTime.of(9, 0)).duration(30)
                    .type("Consultation").status(Appointment.AppointmentStatus.CONFIRMED).room("Salle 1").build());

            appointmentRepo.save(Appointment.builder().patient(p2).doctor(doctor)
                    .date(today).time(LocalTime.of(9, 30)).duration(45)
                    .type("Suivi").status(Appointment.AppointmentStatus.CONFIRMED).room("Salle 1").build());

            appointmentRepo.save(Appointment.builder().patient(p3).doctor(doctor)
                    .date(today).time(LocalTime.of(10, 30)).duration(30)
                    .type("Bilan").status(Appointment.AppointmentStatus.PENDING).build());

            appointmentRepo.save(Appointment.builder().patient(p4).doctor(doctor)
                    .date(today).time(LocalTime.of(11, 0)).duration(60)
                    .type("Consultation cardiaque").status(Appointment.AppointmentStatus.CONFIRMED)
                    .room("Salle 1").notes("ECG requis").build());

            appointmentRepo.save(Appointment.builder().patient(p5).doctor(doctor)
                    .date(today).time(LocalTime.of(14, 0)).duration(30)
                    .type("Consultation").status(Appointment.AppointmentStatus.PENDING).build());

            appointmentRepo.save(Appointment.builder().patient(p6).doctor(doctor)
                    .date(today.minusDays(1)).time(LocalTime.of(11, 0)).duration(30)
                    .type("Contrôle glycémie").status(Appointment.AppointmentStatus.COMPLETED).build());

            appointmentRepo.save(Appointment.builder().patient(p7).doctor(doctor)
                    .date(today.plusDays(1)).time(LocalTime.of(9, 0)).duration(30)
                    .type("Suivi anémie").status(Appointment.AppointmentStatus.CONFIRMED).build());

            appointmentRepo.save(Appointment.builder().patient(p8).doctor(doctor)
                    .date(today.plusDays(1)).time(LocalTime.of(10, 0)).duration(45)
                    .type("Bilan annuel").status(Appointment.AppointmentStatus.CONFIRMED).build());

            appointmentRepo.save(Appointment.builder().patient(p3).doctor(doctor)
                    .date(today.minusDays(6)).time(LocalTime.of(14, 30)).duration(30)
                    .type("Consultation").status(Appointment.AppointmentStatus.CANCELLED)
                    .notes("Annulé par patient").build());

            // ── Invoices ──
            InvoiceItem item1 = InvoiceItem.builder().description("Consultation cardiologie").quantity(1)
                    .unitPrice(BigDecimal.valueOf(400)).total(BigDecimal.valueOf(400)).build();
            InvoiceItem item2 = InvoiceItem.builder().description("ECG").quantity(1)
                    .unitPrice(BigDecimal.valueOf(150)).total(BigDecimal.valueOf(150)).build();

            invoiceRepo.save(Invoice.builder()
                    .invoiceNumber("INV-2025-001").patient(p1).doctor(doctor)
                    .date(today).dueDate(today.plusDays(14))
                    .items(List.of(item1, item2))
                    .total(BigDecimal.valueOf(550)).paid(BigDecimal.valueOf(550))
                    .status(Invoice.PaymentStatus.PAID).build());

            invoiceRepo.save(Invoice.builder()
                    .invoiceNumber("INV-2025-002").patient(p2).doctor(doctor)
                    .date(today.minusDays(1)).dueDate(today.plusDays(13))
                    .items(List.of(InvoiceItem.builder().description("Consultation suivi").quantity(1)
                            .unitPrice(BigDecimal.valueOf(350)).total(BigDecimal.valueOf(350)).build()))
                    .total(BigDecimal.valueOf(350)).paid(BigDecimal.ZERO)
                    .status(Invoice.PaymentStatus.UNPAID).build());

            invoiceRepo.save(Invoice.builder()
                    .invoiceNumber("INV-2025-003").patient(p4).doctor(doctor)
                    .date(today.minusDays(2)).dueDate(today.plusDays(12))
                    .items(List.of(
                            InvoiceItem.builder().description("Consultation urgence").quantity(1)
                                    .unitPrice(BigDecimal.valueOf(500)).total(BigDecimal.valueOf(500)).build(),
                            InvoiceItem.builder().description("Bilan sanguin").quantity(1)
                                    .unitPrice(BigDecimal.valueOf(200)).total(BigDecimal.valueOf(200)).build()))
                    .total(BigDecimal.valueOf(700)).paid(BigDecimal.valueOf(350))
                    .status(Invoice.PaymentStatus.PARTIAL).build());

            invoiceRepo.save(Invoice.builder()
                    .invoiceNumber("INV-2025-004").patient(p5).doctor(doctor)
                    .date(today.minusDays(11)).dueDate(today.plusDays(3))
                    .items(List.of(InvoiceItem.builder().description("Bilan complet").quantity(1)
                            .unitPrice(BigDecimal.valueOf(600)).total(BigDecimal.valueOf(600)).build()))
                    .total(BigDecimal.valueOf(600)).paid(BigDecimal.ZERO)
                    .status(Invoice.PaymentStatus.UNPAID).build());

            // ── Prescriptions ──
            prescriptionRepo.save(Prescription.builder()
                    .patient(p1).doctor(doctor)
                    .date(today).diagnosis("Hypertension artérielle")
                    .medications(List.of(
                            Medication.builder().name("Amlodipine").dosage("5mg")
                                    .frequency("1x/jour").duration("3 mois").instructions("Le matin à jeun").build(),
                            Medication.builder().name("Ramipril").dosage("10mg")
                                    .frequency("1x/jour").duration("3 mois").build()))
                    .status(Prescription.PrescriptionStatus.ACTIVE).build());

            prescriptionRepo.save(Prescription.builder()
                    .patient(p4).doctor(doctor)
                    .date(today.minusDays(2)).diagnosis("Insuffisance cardiaque chronique")
                    .medications(List.of(
                            Medication.builder().name("Bisoprolol").dosage("2.5mg")
                                    .frequency("1x/jour").duration("6 mois").build(),
                            Medication.builder().name("Furosémide").dosage("40mg")
                                    .frequency("1x/jour").duration("1 mois").instructions("Surveiller kaliémie").build()))
                    .status(Prescription.PrescriptionStatus.ACTIVE).build());

            // ── Notifications ──
            notifRepo.save(Notification.builder().user(doctor)
                    .title("RDV dans 30 minutes")
                    .message("Amina Benali - Consultation à 09:00")
                    .type(Notification.NotificationType.APPOINTMENT).read(false).build());

            notifRepo.save(Notification.builder().user(doctor)
                    .title("Paiement reçu")
                    .message("INV-2025-001 — 550 MAD reçu de Amina Benali")
                    .type(Notification.NotificationType.PAYMENT).read(false).build());

            notifRepo.save(Notification.builder().user(doctor)
                    .title("Facture impayée")
                    .message("INV-2025-004 — Nadia Cherkaoui — 600 MAD en attente")
                    .type(Notification.NotificationType.PAYMENT).read(false).build());

            log.info("=== {} patients, appointments, invoices créés ===", patientRepo.count());
        };
    }
}
