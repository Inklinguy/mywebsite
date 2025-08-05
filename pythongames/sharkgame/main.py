import pygame
import sys
import random
import math

# Initialize pygame
pygame.init()

WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Shark Game with Solid Terrain")
clock = pygame.time.Clock()

AIR_COLOR = (135, 206, 235)
WATER_COLOR = (0, 105, 148)

# Shark setup (reduce speeds/forces by 30%)
shark = pygame.Rect(100, HEIGHT // 2, 83, 83)  # 64x64 scaled by 1.3
velocity_y = 0
shark_speed = 7            # was 10
gravity_air = 0.56         # was 0.8
drag_water = 0.1
swim_force = 1.1           # was 1.6
jump_force = 15            # was 21
max_fall_speed = 10        # was 14
can_jump = True

# Terrain setup (Ecco-style sine wave)
TERRAIN_COLOR = (60, 40, 30)
terrain_wave_amplitude = 65
terrain_wave_length = 320
terrain_offset = 0
terrain_heights = []

def generate_terrain():
    global terrain_heights, terrain_offset
    base = HEIGHT - 100
    if not terrain_heights:
        last = base
    else:
        last = terrain_heights[-1]
    terrain_heights = []
    for x in range(WIDTH):
        change = random.randint(-8, 8)  # Increased from (-2, 2)
        last = max(HEIGHT // 2, min(HEIGHT - 40, last + change))
        terrain_heights.append(last)

def update_terrain():
    global terrain_heights
    # Shift terrain left
    terrain_heights = terrain_heights[3:]  # was [5:]
    # Add new points at the end
    last = terrain_heights[-1]
    for _ in range(3):                     # was range(5)
        change = random.randint(-8, 8)
        last = max(HEIGHT // 2, min(HEIGHT - 40, last + change))
        terrain_heights.append(last)

def draw_terrain():
    terrain_points = [(x, terrain_heights[x]) for x in range(WIDTH)]
    terrain_points += [(WIDTH, HEIGHT), (0, HEIGHT)]
    pygame.draw.polygon(screen, TERRAIN_COLOR, terrain_points)

def shark_collides_with_terrain():
    shark_bottom = shark.bottom
    for x in range(shark.left, shark.right):
        if 0 <= x < WIDTH:
            if shark_bottom >= terrain_heights[x]:
                return True
    return False

def shark_hits_surface():
    return shark.top < HEIGHT // 3

# Load images
shark_img = pygame.image.load("assets/shark.png").convert_alpha()
shark_img = pygame.transform.scale(shark_img, (120, 120))
fish_img = pygame.image.load("assets/fish.png").convert_alpha()
fish_img = pygame.transform.scale(fish_img, (40, 40))
crab_img = pygame.image.load("assets/crab.png").convert_alpha()
crab_img = pygame.transform.scale(crab_img, (40, 40))
orca_img = pygame.image.load("assets/orca.png").convert_alpha()
orca_img = pygame.transform.scale(orca_img, (160, 100))
seagull_img = pygame.image.load("assets/seagull.png").convert_alpha()
seagull_img = pygame.transform.scale(seagull_img, (50, 40))

# Entities
fishes = []
crabs = []
seagulls = []
orca = pygame.Rect(-200, 400, 160, 100)
orca_active = False
orca_direction = 1

font = pygame.font.SysFont(None, 24)
score = 0

# Add these at the top, after score:
game_time = 60  # seconds
timer_font = pygame.font.SysFont(None, 32)
game_over = False

# Add this after seagulls entity setup:
clouds = []
for _ in range(6):
    x = random.randint(0, WIDTH)
    y = random.randint(10, HEIGHT // 4)
    w = random.randint(80, 160)
    h = random.randint(30, 60)
    speed = random.uniform(0.14, 0.42)  # was (0.2, 0.6)
    clouds.append({'rect': pygame.Rect(x, y, w, h), 'speed': speed, 'x': float(x)})

def spawn_fish():
    # Spawn fish in both lower and upper water regions
    if random.random() < 0.5:
        # Lower 2/3 of water
        y = random.randint(HEIGHT // 2, HEIGHT - 100)
    else:
        # Upper 1/3 of water (just below surface)
        y = random.randint(HEIGHT // 3 + 10, HEIGHT // 2 - 20)
    fishes.append(pygame.Rect(WIDTH + 20, y, 40, 40))

def spawn_crab():
    # 50% chance to spawn on terrain, 50% in upper water
    if random.random() < 0.5:
        # On terrain at the far right
        y = terrain_heights[-1] - 40
    else:
        # In upper 1/3 of water
        y = random.randint(HEIGHT // 3 + 10, HEIGHT // 2 - 20)
    crabs.append(pygame.Rect(WIDTH + 20, y, 40, 40))

def spawn_orca():
    global orca_active, orca_direction
    orca_active = True
    orca_direction = random.choice([-1, 1])
    if orca_direction == 1:
        orca.x = -200
    else:
        orca.x = WIDTH + 200
    # 50% chance to spawn in upper 1/3 of water, 50% in lower
    if random.random() < 0.5:
        orca.y = random.randint(HEIGHT // 3 + 10, HEIGHT // 2 - 60)
    else:
        orca.y = random.randint(HEIGHT // 2, HEIGHT - 100)

def spawn_seagull():
    # Seagulls fly above the water surface
    y = random.randint(10, HEIGHT // 3 - 50)
    seagulls.append(pygame.Rect(WIDTH + 20, y, 50, 40))

def draw_scene():
    screen.fill(AIR_COLOR)
    # Draw and scroll clouds smoothly
    for cloud in clouds:
        cloud['x'] -= cloud['speed']
        if cloud['x'] + cloud['rect'].width < 0:
            cloud['x'] = WIDTH
            cloud['rect'].y = random.randint(10, HEIGHT // 4)
        cloud['rect'].x = int(cloud['x'])
        pygame.draw.ellipse(screen, (255, 255, 255), cloud['rect'])
    pygame.draw.rect(screen, WATER_COLOR, (0, HEIGHT // 3, WIDTH, HEIGHT))
    screen.blit(shark_img, shark)
    draw_terrain()
    for f in fishes:
        screen.blit(fish_img, f)
    for c in crabs:
        screen.blit(crab_img, c)
    for s in seagulls:
        screen.blit(seagull_img, s)
    if orca_active:
        flipped = pygame.transform.flip(orca_img, orca_direction == -1, False)
        screen.blit(flipped, orca)

def draw_score():
    text = font.render(f"Score: {score}", True, (0, 0, 0))
    screen.blit(text, (10, 10))
    timer_text = timer_font.render(f"Time: {max(0, int(game_time))}", True, (200, 0, 0))
    screen.blit(timer_text, (WIDTH - 140, 10))

def flash_screen():
    for _ in range(6):
        screen.fill((255, 255, 255))
        pygame.display.flip()
        pygame.time.delay(60)
        draw_scene()
        draw_score()
        pygame.display.flip()
        pygame.time.delay(60)

# --- Virtual Joystick for Mobile Touch Control ---
JOYSTICK_RADIUS = 60
JOYSTICK_BASE_RADIUS = 80
JOYSTICK_CENTER = (WIDTH - 100, HEIGHT - 100)
joystick_active = False
joystick_pos = JOYSTICK_CENTER

def draw_joystick():
    # Draw base
    base_surf = pygame.Surface((JOYSTICK_BASE_RADIUS*2, JOYSTICK_BASE_RADIUS*2), pygame.SRCALPHA)
    pygame.draw.circle(base_surf, (180,180,180,90), (JOYSTICK_BASE_RADIUS, JOYSTICK_BASE_RADIUS), JOYSTICK_BASE_RADIUS)
    screen.blit(base_surf, (JOYSTICK_CENTER[0]-JOYSTICK_BASE_RADIUS, JOYSTICK_CENTER[1]-JOYSTICK_BASE_RADIUS))
    # Draw stick
    stick_surf = pygame.Surface((JOYSTICK_RADIUS*2, JOYSTICK_RADIUS*2), pygame.SRCALPHA)
    pygame.draw.circle(stick_surf, (120,120,120,180), (JOYSTICK_RADIUS, JOYSTICK_RADIUS), JOYSTICK_RADIUS)
    stick_draw_pos = (int(joystick_pos[0]-JOYSTICK_RADIUS), int(joystick_pos[1]-JOYSTICK_RADIUS))
    screen.blit(stick_surf, stick_draw_pos)

def get_joystick_dir():
    dx = joystick_pos[0] - JOYSTICK_CENTER[0]
    dy = joystick_pos[1] - JOYSTICK_CENTER[1]
    dist = math.hypot(dx, dy)
    if dist < JOYSTICK_RADIUS * 0.3:
        return []
    angle = math.atan2(-dy, dx)  # y is inverted in screen coords
    dirs = []
    if -math.pi/4 < angle < math.pi/4:
        dirs.append('right')
    if math.pi/4 < angle < 3*math.pi/4:
        dirs.append('up')
    if angle > 3*math.pi/4 or angle < -3*math.pi/4:
        dirs.append('left')
    if -3*math.pi/4 < angle < -math.pi/4:
        dirs.append('down')
    return dirs

def main():
    global velocity_y, can_jump, score, orca_active, game_time, game_over
    global joystick_active, joystick_pos
    spawn_timer = 0
    generate_terrain()  # Initialize terrain
    prev_up = False  # Track previous UP key state
    last_tick = pygame.time.get_ticks()
    next_time_bonus = 30  # Next score threshold for time extension

    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()

        # --- Touch joystick for mobile/web ---
        mouse_pressed = pygame.mouse.get_pressed()
        mouse_pos = pygame.mouse.get_pos()

        # Start drag
        if mouse_pressed[0]:
            mx, my = mouse_pos
            if not joystick_active:
                # Only activate if touch/click is inside base
                if math.hypot(mx - JOYSTICK_CENTER[0], my - JOYSTICK_CENTER[1]) < JOYSTICK_BASE_RADIUS:
                    joystick_active = True
            if joystick_active:
                # Clamp stick to base radius
                dx = mx - JOYSTICK_CENTER[0]
                dy = my - JOYSTICK_CENTER[1]
                dist = math.hypot(dx, dy)
                if dist > JOYSTICK_BASE_RADIUS:
                    dx = dx * JOYSTICK_BASE_RADIUS / dist
                    dy = dy * JOYSTICK_BASE_RADIUS / dist
                joystick_pos = (JOYSTICK_CENTER[0] + dx, JOYSTICK_CENTER[1] + dy)
        else:
            joystick_active = False
            joystick_pos = JOYSTICK_CENTER

        # Map joystick direction to key states
        keys = pygame.key.get_pressed()
        joystick_dirs = get_joystick_dir() if joystick_active else []
        up_pressed = keys[pygame.K_UP] or ('up' in joystick_dirs)
        down_pressed = keys[pygame.K_DOWN] or ('down' in joystick_dirs)
        left_pressed = keys[pygame.K_LEFT] or ('left' in joystick_dirs)
        right_pressed = keys[pygame.K_RIGHT] or ('right' in joystick_dirs)

        in_water = shark.top >= HEIGHT // 3
        at_surface = abs(shark.top - HEIGHT // 3) < 15  # Looser margin

        # --- Only trigger jump on key press, not while held ---
        if up_pressed and not prev_up:
            if in_water and at_surface and can_jump:
                velocity_y = -jump_force  # Jump out of water
                can_jump = False
        elif up_pressed:
            if in_water and not at_surface:
                velocity_y -= swim_force  # Swim up
        else:
            if at_surface:
                can_jump = True

        prev_up = up_pressed  # Update previous UP state

        if down_pressed and in_water:
            velocity_y += swim_force

        # Gravity/buoyancy always applies
        if shark.top < HEIGHT // 3:
            velocity_y += gravity_air  # Apply gravity in air
        else:
            velocity_y += gravity_air * 0.15  # Less gravity in water
            velocity_y *= (1 - drag_water)    # Water drag

        velocity_y = max(-25, min(velocity_y, max_fall_speed))
        shark.y += int(velocity_y)

        if in_water and shark.bottom < HEIGHT:
            can_jump = True

        if shark.bottom > HEIGHT:
            shark.bottom = HEIGHT
            velocity_y = 0

        # Collision with terrain (bottom)
        while shark_collides_with_terrain():
            shark.y -= 1
            velocity_y = 0
            can_jump = True

        if left_pressed:
            shark.x -= shark_speed
        if right_pressed:
            shark.x += shark_speed

        shark.clamp_ip(screen.get_rect())

        # Update terrain
        update_terrain()

        # Move and remove entities, handle collisions
        for f in fishes[:]:
            f.x -= 8               # was 11
            if f.right < 0:
                fishes.remove(f)
            elif shark.colliderect(f):
                fishes.remove(f)
                score += 1  # Fish: +1 point

        for c in crabs[:]:
            c.x -= 8               # was 11
            if c.right < 0:
                crabs.remove(c)
            elif shark.colliderect(c):
                crabs.remove(c)
                score -= 1  # Crab: -1 point
                if score < 0:
                    score = 0

        for s in seagulls[:]:
            s.x -= 8               # was 11
            if s.right < 0:
                seagulls.remove(s)
            elif shark.colliderect(s):
                seagulls.remove(s)
                score += 4  # Seagull: +4 points

        if orca_active:
            orca.x += orca_direction * 4  # Slow and smooth orca movement
            if (orca_direction == 1 and orca.left > WIDTH) or (orca_direction == -1 and orca.right < 0):
                orca_active = False  # Orca leaves the screen, allow respawn
            elif shark.colliderect(orca):
                flash_screen()  # Flash the screen on orca hit
                score = 0  # Orca resets score
                shark.y = HEIGHT // 2
                orca_active = False

        # Orca spawning: more frequent and reliable
        if not orca_active and spawn_timer % 180 == 0:
            spawn_orca()

        # Spawning
        spawn_timer += 1
        if spawn_timer % 45 == 0:  # was 90, now twice as often
            spawn_fish()
        if spawn_timer % 150 == 0:  # was 300, now twice as often for more crabs
            spawn_crab()
        if spawn_timer % 200 == 0:
            spawn_seagull()

        draw_scene()
        draw_joystick()
        draw_score()
        pygame.display.flip()
        clock.tick(60)

        # Timer logic and time extension for every 30 points
        if not game_over:
            now = pygame.time.get_ticks()
            elapsed = (now - last_tick) / 1000.0
            last_tick = now
            game_time -= elapsed

            # Time extension logic
            while score >= next_time_bonus:
                game_time += 20
                next_time_bonus += 30

            if game_time <= 0:
                game_time = 0
                game_over = True

        # Show GAME OVER text and handle restart/quit
        if game_over:
            over_text = timer_font.render("GAME OVER", True, (255, 0, 0))
            screen.blit(over_text, (WIDTH // 2 - 100, HEIGHT // 2 - 40))
            prompt_text = font.render("Press Y to play again or N to quit", True, (0, 0, 0))
            screen.blit(prompt_text, (WIDTH // 2 - 160, HEIGHT // 2 + 10))
            pygame.display.flip()

            waiting = True
            while waiting:
                for event in pygame.event.get():
                    if event.type == pygame.QUIT:
                        pygame.quit()
                        sys.exit()
                    if event.type == pygame.KEYDOWN:
                        if event.key == pygame.K_y:
                            # Restart game state
                            score = 0
                            game_time = 60
                            next_time_bonus = 30
                            fishes.clear()
                            crabs.clear()
                            seagulls.clear()
                            orca_active = False
                            shark.x, shark.y = 100, HEIGHT // 2
                            velocity_y = 0
                            generate_terrain()
                            spawn_timer = 0
                            game_over = False
                            waiting = False
                        elif event.key == pygame.K_n:
                            pygame.quit()
                            sys.exit()
                clock.tick(30)
            continue  # Skip rest of loop until restart

if __name__ == "__main__":
    main()
