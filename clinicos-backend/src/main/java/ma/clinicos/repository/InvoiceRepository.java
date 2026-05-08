package ma.clinicos.repository;

import ma.clinicos.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface InvoiceRepository extends JpaRepository<Invoice, String> {

    List<Invoice> findByPatientId(String patientId);

    List<Invoice> findByStatus(Invoice.PaymentStatus status);

    @Query("SELECT COALESCE(SUM(i.paid), 0) FROM Invoice i WHERE MONTH(i.date) = :month AND YEAR(i.date) = :year")
    BigDecimal sumRevenueByMonthAndYear(int month, int year);

    long countByStatus(Invoice.PaymentStatus status);
}
