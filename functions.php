<?php
if (!defined('ABSPATH')) exit;
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style('junia-emg-studio', get_stylesheet_uri(), array(), '1.0.0');
    wp_enqueue_script('junia-emg-studio', get_template_directory_uri() . '/studio.js', array(), '1.0.0', true);
});
