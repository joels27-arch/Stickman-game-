// Your runner: lanes, jump, slide (a fast drop in the air), bus roofs and ramps, obstacles,
// pickups (coins, hearts, boost/slow pads, mystery boxes) and the two endless gadgets:
// the shield (saves you once) and the rocket (fly over everything for a few seconds).
// Rules and numbers follow the web game (client.js / logic.js).
using System;
using UnityEngine;

namespace LaneRush
{
    public enum Power { None, Shield, Rocket }

    public sealed class Runner : MonoBehaviour
    {
        const float JumpV = 8.6f, Gravity = 26f, SlideS = 0.75f, LaneS = 0.12f;
        const float BoostS = 1.6f, SlowS = 1.3f, ShieldS = 9f, RocketS = 3.2f, RocketY = 3.6f;
        const float HurdleClear = 0.55f, RollerClear = 0.7f;

        public double D;          // distance run (m)
        public float X;           // lane position (0…3, smooth)
        public int Lane = 1;      // lane you're heading for
        public float Y, Vy;       // height and vertical speed
        public float SlideT, BoostT, SlowT, HitT, PowerT;
        public Power Held = Power.None;   // in your slot
        public Power Active = Power.None; // being used
        public int Lives = 1, Coins;
        public bool Out;
        public double RunTime;
        public float Speed;
        public event Action<string> Toast;
        public event Action<string> Sfx;

        CourseView view;
        RunnerModel model;
        GameObject shieldFx, rocketFx;
        double lastD;

        public void Begin(CourseView v, RunnerModel m, int startLane = 1)
        {
            view = v;
            model = m;
            D = lastD = 0;
            Lane = startLane;
            X = startLane;
            Y = Vy = 0;
            SlideT = BoostT = SlowT = HitT = PowerT = 0;
            Lives = 1;
            Coins = 0;
            Out = false;
            RunTime = 0;
            Held = UnityEngine.Random.value < 0.5f ? Power.Shield : Power.Rocket; // the run starts with a gadget
            Active = Power.None;
            if (shieldFx == null)
            {
                shieldFx = Mats.Prim(PrimitiveType.Sphere, Mats.Transparent(new Color(0.4f, 0.8f, 1f, 0.28f)), transform, new Vector3(0, 0.85f, 0), Vector3.one * 2.1f, "Shield");
                rocketFx = Mats.Prim(PrimitiveType.Capsule, Mats.Glow(new Color(1f, 0.55f, 0.15f), 1.2f), transform, new Vector3(0, 0.6f, -0.45f), new Vector3(0.35f, 0.45f, 0.35f), "Rocket flame");
            }
            shieldFx.SetActive(false);
            rocketFx.SetActive(false);
        }

        // ── input ──
        public void Move(int dir)
        {
            if (Out) return;
            int to = Mathf.Clamp(Lane + dir, 0, Rules.Lanes - 1);
            if (to == Lane) return;
            // you can't run into a bus's side from the road (you can step off a roof)
            if (Active != Power.Rocket && view.Course.BusAt(to, D) && Y < Rules.BusH - 0.3f && view.Course.FloorAt(to, D) > Y + 0.3f)
            {
                Sfx?.Invoke("bonk");
                return;
            }
            Lane = to;
            Sfx?.Invoke("whoosh");
        }

        public void Jump()
        {
            if (Out || Active == Power.Rocket) return;
            if (Y <= Floor() + 0.05f) { Vy = JumpV; SlideT = 0; model?.Play("jump"); Sfx?.Invoke("jump"); }
        }

        public void Slide()
        {
            if (Out || Active == Power.Rocket) return;
            if (Y > Floor() + 0.05f) Vy = -18f; // in the air: drop down fast
            SlideT = SlideS;
            model?.Play("slide");
        }

        public void UseItem()
        {
            if (Out || Held == Power.None || Active != Power.None) return;
            Active = Held;
            Held = Power.None;
            PowerT = Active == Power.Shield ? ShieldS : RocketS;
            Sfx?.Invoke(Active == Power.Rocket ? "rocket" : "shield");
            Toast?.Invoke(Active == Power.Rocket ? "ROCKET!" : "SHIELD UP!");
        }

        float Floor() => (float)view.Course.FloorAt(Mathf.RoundToInt(X), D);

        // ── the run ──
        public void Tick(float dt)
        {
            if (Out) { model?.Tick(dt, false); return; }
            RunTime += dt;
            BoostT = Mathf.Max(0, BoostT - dt);
            SlowT = Mathf.Max(0, SlowT - dt);
            HitT = Mathf.Max(0, HitT - dt);
            SlideT = Mathf.Max(0, SlideT - dt);
            if (Active != Power.None)
            {
                PowerT -= dt;
                if (PowerT <= 0) { Active = Power.None; Vy = 0; }
            }

            Speed = (float)Rules.SurvivalSpeed(RunTime);
            if (BoostT > 0) Speed += (float)Rules.SurvivalBoost;
            if (Active == Power.Rocket) Speed += (float)Rules.SurvivalRocket;
            if (SlowT > 0) Speed *= 0.6f;
            if (HitT > 0.6f) Speed *= 0.4f; // a stumble

            lastD = D;
            D += Speed * dt;
            X = Mathf.MoveTowards(X, Lane, dt / LaneS);

            // height: the floor under you (road, ramp, roof), jumping, falling, flying
            float floor = Floor();
            if (Active == Power.Rocket)
            {
                Y = Mathf.MoveTowards(Y, Mathf.Max(floor, 0) + RocketY, dt * 9f);
                Vy = 0;
            }
            else
            {
                Vy -= Gravity * (Vy < 0 ? 1.3f : 1f) * dt;
                Y += Vy * dt;
                if (Y <= floor)
                {
                    bool climbing = floor > 0.05f && floor < Rules.BusH - 0.01f; // up a ramp
                    if (Vy < -2f && !climbing) model?.Play("run");
                    Y = floor;
                    Vy = 0;
                }
            }

            Collide();
            Pickups();

            shieldFx.SetActive(Active == Power.Shield);
            rocketFx.SetActive(Active == Power.Rocket);
            transform.localPosition = new Vector3(World.LaneX(X), Y, (float)D);
            bool air = Y > floor + 0.1f && Active != Power.Rocket;
            model?.Tick(dt, true, air, SlideT > 0, Active == Power.Rocket, Speed);
        }

        void Collide()
        {
            if (Active == Power.Rocket) return;
            int lane = Mathf.RoundToInt(X);
            var c = view.Course;
            float lift = Y - (float)c.FloorAt(lane, D);
            foreach (var it in view.Items)
            {
                if (it.Go == null || it.Taken) continue;
                if (it.Kind == ItemKind.Bus)
                {
                    // a bus without a ramp: its front is a wall unless you're above the roof
                    if (!it.Ramp && it.Lane == lane && lastD < it.Z && D >= it.Z && Y < Rules.BusH - 0.15f)
                    {
                        it.Taken = true;
                        Hit("You ran into a bus!");
                        D = it.Z - 0.6;
                    }
                    continue;
                }
                if (it.Lane != lane) continue;
                if (it.Kind == ItemKind.Roller)
                {
                    double rz = view.RollerZ(it, D, RunTime);
                    if (Math.Abs(rz - D) < 0.6 && lift < RollerClear) { it.Taken = true; Hit("A barrel got you!"); }
                    else if (rz < D - 1) it.Taken = true; // rolled past
                    continue;
                }
                if (!(lastD < it.Z && D >= it.Z)) continue;
                switch (it.Kind)
                {
                    case ItemKind.Hurdle: if (lift < HurdleClear) { it.Taken = true; Hit("Tripped on a hurdle!"); } break;
                    case ItemKind.Gate: if (SlideT <= 0) { it.Taken = true; Hit("Hit a gate!"); } break;
                    case ItemKind.Crate: it.Taken = true; Hit("Crashed into crates!"); break;
                }
            }
        }

        void Pickups()
        {
            int lane = Mathf.RoundToInt(X);
            float floorY = (float)view.Course.FloorAt(lane, D);
            foreach (var it in view.Items)
            {
                if (it.Go == null || it.Taken || it.Lane != lane) continue;
                if (it.Kind != ItemKind.Boost && it.Kind != ItemKind.Slow && it.Kind != ItemKind.Box && it.Kind != ItemKind.Heart) continue;
                if (Math.Abs(it.Z - D) > 1.2) continue;
                bool onPad = Y - floorY < 0.4f && Active != Power.Rocket;
                switch (it.Kind)
                {
                    case ItemKind.Boost: if (onPad) { it.Taken = true; BoostT = BoostS; Sfx?.Invoke("boost"); Toast?.Invoke("BOOST!"); } break;
                    case ItemKind.Slow: if (onPad && Active != Power.Shield) { it.Taken = true; SlowT = SlowS; Sfx?.Invoke("slow"); } break;
                    case ItemKind.Box:
                        it.Taken = true;
                        if (Held == Power.None) { Held = UnityEngine.Random.value < 0.5f ? Power.Shield : Power.Rocket; Sfx?.Invoke("box"); Toast?.Invoke(Held == Power.Shield ? "Got a SHIELD" : "Got a ROCKET"); }
                        break;
                    case ItemKind.Heart:
                        it.Taken = true;
                        if (Lives < Rules.Lives) { Lives++; Toast?.Invoke("+1 HEART"); }
                        else { Coins += 10; Toast?.Invoke("+10 coins"); }
                        Sfx?.Invoke("coin");
                        break;
                }
            }
            foreach (var c in view.Coins)
            {
                if (c.Go == null || c.Taken || c.Lane != lane) continue;
                if (Math.Abs(c.Z - D) < 0.9 && Mathf.Abs(Y - (floorY + 0.9f)) < 1.6f) { c.Taken = true; Coins++; Sfx?.Invoke("coin"); }
            }
        }

        void Hit(string why)
        {
            if (HitT > 0) return; // just hit: a moment to recover
            if (Active == Power.Shield) { Active = Power.None; PowerT = 0; HitT = 1f; Toast?.Invoke("SHIELD SAVED YOU!"); Sfx?.Invoke("shield"); return; }
            Lives--;
            HitT = 1.2f;
            Sfx?.Invoke("bonk");
            if (Lives <= 0) { Out = true; Toast?.Invoke(why); model?.Play("fall"); return; }
            Toast?.Invoke(why + " -1 heart");
            model?.Play("fall");
        }
    }
}
