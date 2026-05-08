package ma.clinicos.dto;
public record AuthResponse(String token, String role, String name, String email) {}
