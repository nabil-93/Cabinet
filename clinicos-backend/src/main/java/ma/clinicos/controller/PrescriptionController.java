package ma.clinicos.controller;

import lombok.RequiredArgsConstructor;
import ma.clinicos.dto.PrescriptionResponse;
import ma.clinicos.service.PrescriptionService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/prescriptions")
@RequiredArgsConstructor
public class PrescriptionController {

    private final PrescriptionService prescriptionService;

    @GetMapping
    public List<PrescriptionResponse> getAll() {
        return prescriptionService.findAll();
    }

    @GetMapping("/patient/{patientId}")
    public List<PrescriptionResponse> getByPatient(@PathVariable String patientId) {
        return prescriptionService.findByPatient(patientId);
    }
}
