package ma.clinicos.controller;

import lombok.RequiredArgsConstructor;
import ma.clinicos.dto.NotificationResponse;
import ma.clinicos.entity.User;
import ma.clinicos.service.NotificationService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public List<NotificationResponse> getMyNotifications(@AuthenticationPrincipal User user) {
        return notificationService.findByUser(user.getId());
    }

    @GetMapping("/unread-count")
    public long getUnreadCount(@AuthenticationPrincipal User user) {
        return notificationService.countUnread(user.getId());
    }

    @PatchMapping("/{id}/read")
    public void markRead(@PathVariable String id) {
        notificationService.markRead(id);
    }

    @PatchMapping("/read-all")
    public void markAllRead(@AuthenticationPrincipal User user) {
        notificationService.markAllRead(user.getId());
    }
}
