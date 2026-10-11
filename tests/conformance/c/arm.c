/* Freestanding, source-owned static-analysis fixture. Never executed by REA. */
volatile unsigned int rea_arm_global = 7;
const char rea_arm_marker[] = "rea-arm-source-owned-fixture";

__attribute__((noinline)) unsigned int rea_arm_leaf(unsigned int value)
{
    return value * 3u + rea_arm_global;
}

__attribute__((noinline)) unsigned int rea_arm_entry(unsigned int selector)
{
    unsigned int adjusted = selector > 10u ? selector : selector + 1u;
    return rea_arm_leaf(adjusted) + (unsigned char)rea_arm_marker[0];
}
