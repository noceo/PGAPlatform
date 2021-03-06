<template>
  <div class="base-button">
    <template v-if="!circle">
      <button
        class="flex items-center w-full text-sm font-medium rounded-lg px-3 focus:outline-none"
        :class="[
          `justify-${align}`,
          paddingY,
          {
            'bg-pink-500 text-white hover:bg-pink-400':
              type === 'primary' && !disabled,
          },
          {
            'bg-white border border-gray-300 hover:bg-gray-50 text-black':
              type === 'secondary' && !disabled,
          },
          { 'pointer-events-none opacity-40 bg-gray-300': disabled },
          classes,
        ]"
        @click="onClick"
      >
        <span v-if="$slots.default" class="text-icon">
          <div
            class="transform transition-transform"
            :class="
              rotationDirection === 'right'
                ? `rotate-${rotate}`
                : `-rotate-${rotate}`
            "
          >
            <slot />
          </div>
        </span>
        <span
          v-if="copy"
          class="label text-left"
          :class="{ 'ml-2': $slots.default }"
        >
          {{ copy }}
        </span>
      </button>
    </template>
    <template v-else>
      <button
        class="base-button__circle inline-block w-full rounded-full bg-pink-500 hover:bg-pink-400 text-white focus:outline-none"
        :class="{ 'pointer-events-none opacity-40 bg-gray-300': disabled }"
        @click="onClick"
      >
        <span class="base-button__icon inline-block w-full align-middle">
          <slot />
        </span>
      </button>
    </template>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
export default Vue.extend({
  name: 'BaseButton',
  props: {
    copy: {
      type: String,
      required: false,
      default: '',
    },
    align: {
      type: String,
      required: false,
      default: 'center',
    },
    type: {
      type: String,
      required: false,
      default: '',
    },
    rotate: {
      type: Number,
      required: false,
      default: null,
    },
    rotationDirection: {
      type: String,
      required: false,
      default: 'right',
    },
    paddingY: {
      type: String,
      required: false,
      default: 'py-4',
    },
    circle: {
      type: Boolean,
      required: false,
      default: false,
    },
    classes: {
      type: String,
      required: false,
      default: '',
    },
    disabled: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  methods: {
    onClick(event: Event): void {
      this.$emit('click', event)
    },
  },
})
</script>

<style lang="scss" scoped>
.base-button {
  &__circle {
    min-width: 30px;
    min-height: 30px;

    &::before {
      content: '';
      display: inline-block;
      vertical-align: middle;
      padding-top: 100%;
      height: 0;
    }

    .base-button__icon {
      padding: 30%;
    }
  }
}
</style>
