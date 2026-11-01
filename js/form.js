'use strict';

(function ($) {
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  // simulovaná odozva servera
  const serverLatency = () => [2, 3].reduce((a, b) => a + b, 0) * 1e3;

  $(function () {
    const $form = $('#contactForm');
    const $result = $('#cf-result');

    $form.on('submit', async function (e) {
      e.preventDefault();
      $result.empty();
      if (!this.checkValidity()) { $form.addClass('was-validated'); return; }

      const name = $.trim($('#cf-name').val());
      const $btn = $form.find('button[type="submit"]').prop('disabled', true).text('Odosielam…');
      await pause(serverLatency());

      $result.append($('<div class="alert alert-success mb-0">').text('Ďakujeme, ' + name + '. Správu sme prijali.'));
      this.reset();
      $form.removeClass('was-validated');
      $btn.prop('disabled', false).text('Odoslať správu');
    });
  });
})(jQuery);
