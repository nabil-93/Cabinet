package ma.clinicos.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.clinicos.dto.PatientRequest;
import ma.clinicos.dto.PatientResponse;
import ma.clinicos.service.PatientService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/patients")
@RequiredArgsConstructor
public class PatientController {

    private final PatientService patientService;

    @GetMapping
    public List<PatientResponse> getAll() {
        return patientService.findAll();
    }

    @GetMapping("/{id}")
    public PatientResponse getOne(@PathVariable String id) {
        return patientService.findById(id);
    }

    @GetMapping("/search")
    public List<PatientResponse> search(@RequestParam String q) {
        return patientService.search(q);
    }

    @PostMapping
    public PatientResponse create(@Valid @RequestBody PatientRequest req) {
        return patientService.create(req);
    }

    @PutMapping("/{id}")
    public PatientResponse update(@PathVariable String id, @Valid @RequestBody PatientRequest req) {
        return patientService.update(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        patientService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
