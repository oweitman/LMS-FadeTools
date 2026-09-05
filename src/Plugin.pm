package Plugins::FadeTools::Plugin;

use strict;
use warnings;

use base qw(Slim::Plugin::Base);

use Slim::Control::Request;
use Slim::Utils::Log;

my $log = Slim::Utils::Log->addLogCategory({
    category     => 'plugin.fadetools',
    defaultLevel => 'INFO',
    description  => 'PLUGIN_FADETOOLS_NAME',
});

sub initPlugin {
    my $class = shift;
    $class->SUPER::initPlugin(@_);

    Slim::Control::Request::addDispatch(
        ['fadeout', 'pause', '_seconds'],
        [1, 0, 0, \&fadeOutPause]
    );

    Slim::Control::Request::addDispatch(
        ['fadeout', 'stop', '_seconds'],
        [1, 0, 0, \&fadeOutStop]
    );

    Slim::Control::Request::addDispatch(
        ['fadein', 'play', '_seconds'],
        [1, 0, 0, \&fadeInPlay]
    );

    Slim::Control::Request::addDispatch(
        ['fadein', 'resume', '_seconds'],
        [1, 0, 0, \&fadeInResume]
    );

    # Alias: "fadein pause N" means "resume from pause with fade-in".
    Slim::Control::Request::addDispatch(
        ['fadein', 'pause', '_seconds'],
        [1, 0, 0, \&fadeInResume]
    );

    $log->info('Fade Tools CLI commands registered');
}

sub fadeOutPause {
    my $request = shift;
    return _fadeOut($request, 'pause');
}

sub fadeOutStop {
    my $request = shift;
    return _fadeOut($request, 'stop');
}

sub fadeInPlay {
    my $request = shift;
    return _fadeIn($request, 'play');
}

sub fadeInResume {
    my $request = shift;
    return _fadeIn($request, 'resume');
}

sub _validateRequest {
    my $request = shift;

    my $client = $request->client;
    if (!$client) {
        $request->setStatusBadParams();
        return;
    }

    my $seconds = $request->getParam('_seconds');

    if (!defined($seconds)
        || $seconds !~ /^(?:\d+(?:\.\d*)?|\.\d+)$/
        || $seconds <= 0
        || $seconds > 60) {

        $log->warn(
            'Invalid fade duration: '
            . (defined($seconds) ? $seconds : '<undef>')
        );
        $request->setStatusBadParams();
        return;
    }

    return ($client, 0 + $seconds);
}

sub _fadeOut {
    my ($request, $action) = @_;

    my ($client, $seconds) = _validateRequest($request);
    return if !$client;

    my @players = eval { $client->syncGroupActiveMembers };
    @players = ($client) if !@players;

    my %seen;
    @players = grep {
        defined($_) && !$seen{$_->id}++
    } @players;

    if (!@players) {
        $request->setStatusBadParams();
        return;
    }

    my %restoreVolume;
    for my $player (@players) {
        $restoreVolume{$player->id} = abs($player->volume());
    }

    my $remaining = scalar @players;
    my $finished  = 0;

    my $done = sub {
        return if $finished;

        $remaining--;
        return if $remaining > 0;

        $finished = 1;

        if ($action eq 'pause') {
            $client->execute(['pause', 1]);
        }
        else {
            $client->execute(['stop']);
        }

        for my $player (@players) {
            my $volume = $restoreVolume{$player->id};

            eval {
                $player->volume($volume, 1);
            };

            if ($@) {
                $log->warn(
                    'Could not restore temporary volume for '
                    . $player->id . ': ' . $@
                );
            }
        }
    };

    for my $player (@players) {
        eval {
            $player->fade_volume(-$seconds, $done, []);
        };

        if ($@) {
            $log->error(
                'fade_volume failed for ' . $player->id . ': ' . $@
            );
            $done->();
        }
    }

    $request->setStatusDone();
}

sub _fadeIn {
    my ($request, $action) = @_;

    my ($client, $seconds) = _validateRequest($request);
    return if !$client;

    if ($action eq 'resume') {
        # Native LMS equivalent: pause 0 <fadeInSecs>
        $client->execute(['pause', 0, $seconds]);
    }
    else {
        # Native LMS equivalent: play <fadeInSecs>
        $client->execute(['play', $seconds]);
    }

    $request->setStatusDone();
}

1;
