/* Source-owned ARM and Thumb-2 instructions with fixed, reviewable encodings.
 * No target execution. The ARM probe returns 42; the Thumb probe returns 7.
 */
.syntax unified
.cpu arm7tdmi
.arm
.text
.p2align 2
.globl rea_arm_probe_arm
.type rea_arm_probe_arm, %function
rea_arm_probe_arm:
    mov r0, #42
    bx lr

.thumb
.p2align 1
.globl rea_arm_probe_thumb
.type rea_arm_probe_thumb, %function
.thumb_func
rea_arm_probe_thumb:
    movs r0, #7
    bx lr
.section .note.GNU-stack,"",%progbits
