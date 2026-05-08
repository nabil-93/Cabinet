package ma.clinicos.dto;

import ma.clinicos.entity.Invoice;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

public record InvoiceResponse(
    String id,
    String invoiceNumber,
    String patientId,
    String patientName,
    LocalDate date,
    LocalDate dueDate,
    BigDecimal total,
    BigDecimal paid,
    String status,
    String notes,
    List<InvoiceItemDto> items
) {
    public record InvoiceItemDto(
        String description,
        Integer quantity,
        BigDecimal unitPrice,
        BigDecimal total
    ) {}

    public static InvoiceResponse from(Invoice i) {
        var items = i.getItems() == null ? List.<InvoiceItemDto>of() :
            i.getItems().stream()
                .map(item -> new InvoiceItemDto(
                    item.getDescription(),
                    item.getQuantity(),
                    item.getUnitPrice(),
                    item.getTotal()
                ))
                .collect(Collectors.toList());

        return new InvoiceResponse(
            i.getId(),
            i.getInvoiceNumber(),
            i.getPatient().getId(),
            i.getPatient().getFullName(),
            i.getDate(),
            i.getDueDate(),
            i.getTotal(),
            i.getPaid(),
            i.getStatus().name().toLowerCase(),
            i.getNotes(),
            items
        );
    }
}
