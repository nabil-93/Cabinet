package ma.clinicos.controller;

import lombok.RequiredArgsConstructor;
import ma.clinicos.dto.InvoiceResponse;
import ma.clinicos.service.InvoiceService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/invoices")
@RequiredArgsConstructor
public class InvoiceController {

    private final InvoiceService invoiceService;

    @GetMapping
    public List<InvoiceResponse> getAll() {
        return invoiceService.findAll();
    }

    @PatchMapping("/{id}/pay")
    public InvoiceResponse markPaid(@PathVariable String id) {
        return invoiceService.markAsPaid(id);
    }
}
