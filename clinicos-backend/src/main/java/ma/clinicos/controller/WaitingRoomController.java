package ma.clinicos.controller;

import lombok.RequiredArgsConstructor;
import ma.clinicos.entity.WaitingRoom;
import ma.clinicos.repository.WaitingRoomRepository;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/waiting-room")
@RequiredArgsConstructor
public class WaitingRoomController {

    private final WaitingRoomRepository waitingRoomRepository;

    @GetMapping
    public List<WaitingRoom> getAll() {
        return waitingRoomRepository.findAllByOrderByArrivedAtAsc();
    }

    @GetMapping("/waiting")
    public List<WaitingRoom> getWaiting() {
        return waitingRoomRepository.findByStatusOrderByArrivedAtAsc(WaitingRoom.WaitingStatus.WAITING);
    }
}
