package view;

import java.io.IOException;
import java.sql.SQLException;
import java.util.List;

import javafx.application.Platform;
import javafx.beans.value.ChangeListener;
import javafx.collections.ObservableList;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.control.ProgressBar;
import javafx.scene.layout.GridPane;
import javafx.stage.Stage;
import model.Match;
import model.Shoot;

import org.controlsfx.control.action.Action;
//import org.controlsfx.dialog.Dialog;
//import org.controlsfx.dialog.Dialogs;

import database.Database;

public class Sync extends GridPane {

	@FXML
	private ProgressBar progress;


	private Stage dialog;

	private List<Thread> threads;

	private ChangeListener<Number> networkChange;

	private boolean stop = false;

	public Sync(Stage dialog, ObservableList<Match> matches) {
		this.dialog = dialog;
		try {
			FXMLLoader fxmlLoader = new FXMLLoader(
					CreateSeason.class.getResource("Sync.fxml"));
			fxmlLoader.setRoot(this);
			fxmlLoader.setController(this);
			fxmlLoader.load();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		progress.setProgress(-1);
		try {
			Database.getInstance().startRemoteTransaction();
			Database.getInstance().updateTeamNameRemote();
		} catch (SQLException e) {
			cancelSync();
			return;
		}
		dialog.setOnCloseRequest(t -> {
			stop = true;
		});
		new SyncSeason(matches).start();
	}

	private class SyncSeason extends Thread{
		private ObservableList<Match> matches;

		public SyncSeason(ObservableList<Match> matches){
			this.matches = matches;

		}

		@Override
		public void run() {
			try {
				if(!Database.getInstance().existRemoteMatches()){
					Database.getInstance().uploadToRemote();
				} else {
					Database.getInstance().updateDatesRemote();
				}
				new SyncHomeShoot(matches, 0).start();
			} catch (SQLException e) {
				e.printStackTrace();
				cancelSync();
				return;
			}
		}
	}

	private class SyncHomeShoot extends Thread{
		private ObservableList<Match> matches;
		private int matchNumber;
		private ObservableList<ObservableList<Shoot>> remoteHomeShoots;

		public SyncHomeShoot(ObservableList<Match> matches, int matchNumber){
			this.matches = matches;
			this.matchNumber = matchNumber;
		}

		@Override
		public void run() {
			System.out.println("SyncHomeShoot Woche " + matchNumber);
			Match match = matches.get(matchNumber);
			try {
				remoteHomeShoots = Database.getInstance()
						.tryFastforward(match, match.getHometeam());
			} catch (SQLException e) {
				e.printStackTrace();
				cancelSync();
				return;
			}
			if (remoteHomeShoots != null) {
				Platform.runLater(new Runnable() {
					@Override
					public void run() {
//						Dialog conflictDialog = new Dialog(dialog, "Konflikt");
//						conflictDialog.getActions().addAll(Dialog.Actions.OK,
//								Dialog.Actions.CANCEL);
//						conflictDialog.setContent(new Conflict(match,
//								remoteHomeShoots.get(0), match.getHomeShoots(), remoteHomeShoots.get(1), match.getAddHomeShoots(), match
//								.getHometeam()));
//						Action response = conflictDialog.show();
//
//						if (response == Dialog.Actions.OK) {
//							for (int j = 0; j < 4; j++) {
//								Shoot localShoot = match.getHomeShoots().get(j);
//								Shoot remoteShoot = remoteHomeShoots.get(0).get(j);
//								localShoot.setFirstname(remoteShoot
//										.getFirstname());
//								localShoot.setLastname(remoteShoot
//										.getLastname());
//								localShoot.setAgegroup(remoteShoot
//										.getAgegroup());
//								localShoot.setStartID(remoteShoot.getStartID());
//								localShoot.setEndID(remoteShoot.getEndID());
//								localShoot.setScore(remoteShoot.getScore());
//							}
//							match.getAddHomeShoots().clear();
//							for (Shoot remoteShoot : remoteHomeShoots.get(1)) {
//								Shoot localShoot = Database.getInstance().getSeason().getNewAditionalShoot(match, true);
//								localShoot.setFirstname(remoteShoot
//										.getFirstname());
//								localShoot.setLastname(remoteShoot
//										.getLastname());
//								localShoot.setAgegroup(remoteShoot
//										.getAgegroup());
//								localShoot.setStartID(remoteShoot.getStartID());
//								localShoot.setEndID(remoteShoot.getEndID());
//								localShoot.setScore(remoteShoot.getScore());
//								match.getAddHomeShoots().add(localShoot);
//
//							}
//							new Thread(new Runnable() {
//
//								@Override
//								public void run() {
//									Database.getInstance().updateMatch(match);
//
//								}
//							}).start();
//						} else {
//							new Thread(new Runnable() {
//
//								@Override
//								public void run() {
//									try {
//										Database.getInstance().UpdateMatchToRemote(match);
//									} catch (SQLException e) {
//										e.printStackTrace();
//										cancelSync();
//										return;
//									}
//
//								}
//							}).start();;
//						}
						if(!stop){
							new SyncGuestShoot(matches, matchNumber).start();
						}


					}
				});
			} else {
				if(!stop){
					new SyncGuestShoot(matches, matchNumber).start();
				}
			}
		}
	}

	private class SyncGuestShoot extends Thread{
		private ObservableList<Match> matches;
		private int matchNumber;
		private ObservableList<ObservableList<Shoot>> remoteGuestShoots;

		public SyncGuestShoot(ObservableList<Match> matches, int matchNumber){
			this.matches = matches;
			this.matchNumber = matchNumber;
		}

		@Override
		public void run() {
			System.out.println("SyncGuestShoot Match " + matchNumber);
			Match match = matches.get(matchNumber);

			try {
				remoteGuestShoots = Database.getInstance()
						.tryFastforward(match, match.getGuestteam());
			} catch (SQLException e1) {
				e1.printStackTrace();
				cancelSync();
				return;
			}
			if (remoteGuestShoots != null) {
				Platform.runLater(new Runnable() {
					@Override
					public void run() {
//						Dialog conflictDialog = new Dialog(dialog, "Konflikt");
//						conflictDialog.getActions().addAll(Dialog.Actions.OK,
//								Dialog.Actions.CANCEL);
//						conflictDialog.setContent(new Conflict(match,
//								remoteGuestShoots.get(0), match.getGuestShoots(), remoteGuestShoots.get(1), match.getAddGuestShoots(), match
//										.getGuestteam()));
//						Action response = conflictDialog.show();

//						if (response == Dialog.Actions.OK) {
//							for (int j = 0; j < 4; j++) {
//								Shoot localShoot = match.getGuestShoots().get(j);
//								Shoot remoteShoot = remoteGuestShoots.get(0).get(j);
//								localShoot.setFirstname(remoteShoot
//										.getFirstname());
//								localShoot.setLastname(remoteShoot
//										.getLastname());
//								localShoot.setAgegroup(remoteShoot
//										.getAgegroup());
//								localShoot.setStartID(remoteShoot.getStartID());
//								localShoot.setEndID(remoteShoot.getEndID());
//								localShoot.setScore(remoteShoot.getScore());
//							}
//							match.getAddGuestShoots().clear();
//							for (Shoot remoteShoot : remoteGuestShoots.get(1)) {
//								Shoot localShoot = Database.getInstance().getSeason().getNewAditionalShoot(match, false);
//								localShoot.setFirstname(remoteShoot
//										.getFirstname());
//								localShoot.setLastname(remoteShoot
//										.getLastname());
//								localShoot.setAgegroup(remoteShoot
//										.getAgegroup());
//								localShoot.setStartID(remoteShoot.getStartID());
//								localShoot.setEndID(remoteShoot.getEndID());
//								localShoot.setScore(remoteShoot.getScore());
//								match.getAddGuestShoots().add(localShoot);
//
//							}
//							new Thread(new Runnable() {
//
//								@Override
//								public void run() {
//									Database.getInstance().updateMatch(match);
//									try {
//										Database.getInstance().unchangeMatch(match);
//									} catch (SQLException e) {
//										// TODO Auto-generated catch block
//										e.printStackTrace();
//										cancelSync();
//										return;
//									}
//								}
//							}).start();
//						} else {
//							new Thread(new Runnable() {
//
//								@Override
//								public void run() {
//									try {
//										Database.getInstance().UpdateMatchToRemote(match);
//									} catch (SQLException e) {
//										e.printStackTrace();
//										cancelSync();
//										return;
//									}
//
//								}
//							}).start();;
//						}
						if((matchNumber + 1) < matches.size()){
							if(!stop){
								new SyncHomeShoot(matches, matchNumber + 1).start();
							}
						} else {
							Platform.runLater(new Runnable() {

								@Override
								public void run() {
									try {
										Database.getInstance().commitRemoteTransaction();
									} catch (SQLException e) {
										e.printStackTrace();
										cancelSync();
										return;
									}
									Database.getInstance().refresh();
									dialog.close();

								}
							});
						}

					}
				});

			} else {
				if((matchNumber + 1) < matches.size()){
					if(!stop){
						new SyncHomeShoot(matches, matchNumber + 1).start();
					}
				} else {
					Platform.runLater(new Runnable() {

						@Override
						public void run() {
							try {
								Database.getInstance().commitRemoteTransaction();
							} catch (SQLException e) {
								e.printStackTrace();
								cancelSync();
								return;
							}
							Database.getInstance().refresh();
							dialog.close();

						}
					});
				}
			}
		}
	}

	public void cancelSync() {
		Platform.runLater(new Runnable() {

			@Override
			public void run() {

//				Action response = Dialogs
//						.create()
//						.owner(dialog)
//						.title("Synchronisation Fehlgeschlagen")
//						.message("Bitte prüfen Sie ihre Internetverbindung oder versuchen Sie es später noch einmal.")
//						.actions(Dialog.Actions.OK)
//						.showConfirm();
//				dialog.close();
			}
		});

	}




}
