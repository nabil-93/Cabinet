package ma.clinicos.controller;

import lombok.RequiredArgsConstructor;
import ma.clinicos.dto.AppointmentRequest;
import ma.clinicos.dto.AppointmentResponse;
import ma.clinicos.service.AppointmentService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/appointments")
@RequiredArgsConstructor
public class AppointmentController {

    private final AppointmentService appointmentService;

    @GetMapping
    public List<AppointmentResponse> getAll() {
        return appointmentService.findAll();
    }

    @GetMapping("/date/{date}")
    public List<AppointmentResponse> getByDate(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return appointmentService.findByDate(date);
    }

    @PostMapping
    public AppointmentResponse create(@RequestBody AppointmentRequest req) {
        return appointmentService.create(req);
    }

    @PatchMapping("/{id}/status")
    public AppointmentResponse updateStatus(
            @PathVariable String id,
            @RequestParam String status) {
        return appointmentService.updateStatus(id, status);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        appointmentService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
