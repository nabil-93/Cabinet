package ma.clinicos.repository;

import ma.clinicos.entity.WaitingRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface WaitingRoomRepository extends JpaRepository<WaitingRoom, String> {

    List<WaitingRoom> findByStatusOrderByArrivedAtAsc(WaitingRoom.WaitingStatus status);

    List<WaitingRoom> findAllByOrderByArrivedAtAsc();
}
