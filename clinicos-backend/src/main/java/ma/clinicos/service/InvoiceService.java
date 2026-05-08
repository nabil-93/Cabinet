package ma.clinicos.service;

import lombok.RequiredArgsConstructor;
import ma.clinicos.dto.InvoiceResponse;
import ma.clinicos.entity.Invoice;
import ma.clinicos.repository.InvoiceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final AtomicLong counter = new AtomicLong(1);

    public List<InvoiceResponse> findAll() {
        return invoiceRepository.findAll().stream()
            .map(InvoiceResponse::from)
            .collect(Collectors.toList());
    }

    public List<InvoiceResponse> findByStatus(String status) {
        return invoiceRepository.findByStatus(Invoice.PaymentStatus.valueOf(status.toUpperCase()))
            .stream()
            .map(InvoiceResponse::from)
            .collect(Collectors.toList());
    }

    @Transactional
    public InvoiceResponse markAsPaid(String id) {
        Invoice inv = invoiceRepository.findById(id).orElseThrow();
        inv.setPaid(inv.getTotal());
        inv.setStatus(Invoice.PaymentStatus.PAID);
        return InvoiceResponse.from(invoiceRepository.save(inv));
    }
}
