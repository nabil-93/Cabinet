package ma.clinicos.service;

import lombok.RequiredArgsConstructor;
import ma.clinicos.dto.NotificationResponse;
import ma.clinicos.entity.Notification;
import ma.clinicos.entity.User;
import ma.clinicos.repository.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public List<NotificationResponse> findByUser(String userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
            .stream()
            .map(NotificationResponse::from)
            .collect(Collectors.toList());
    }

    public long countUnread(String userId) {
        return notificationRepository.countByUserIdAndReadFalse(userId);
    }

    @Transactional
    public void markRead(String id) {
        notificationRepository.findById(id).ifPresent(n -> {
            n.setRead(true);
            notificationRepository.save(n);
        });
    }

    @Transactional
    public void markAllRead(String userId) {
        notificationRepository.findByUserIdAndReadFalse(userId).forEach(n -> {
            n.setRead(true);
            notificationRepository.save(n);
        });
    }

    public NotificationResponse create(User user, String title, String message, Notification.NotificationType type) {
        Notification n = Notification.builder()
            .user(user)
            .title(title)
            .message(message)
            .type(type)
            .build();
        return NotificationResponse.from(notificationRepository.save(n));
    }
}
